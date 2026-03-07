import * as parcelWatcher from '@parcel/watcher'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { folderRepository } from '../repositories/folder'
import { noteRepository } from '../repositories/note'
import { csvFileRepository } from '../repositories/csv-file'
import { pdfFileRepository } from '../repositories/pdf-file'
import { imageFileRepository } from '../repositories/image-file'
import { entityLinkRepository } from '../repositories/entity-link'
import { cleanupOrphansAndDelete } from '../lib/orphan-cleanup'
import { readDirRecursiveAsync } from './folder'
import {
  readMdFilesRecursiveAsync,
  readCsvFilesRecursiveAsync,
  readPdfFilesRecursiveAsync,
  readImageFilesRecursiveAsync,
  isImageFile
} from '../lib/fs-utils'
import type { FileEntry } from '../lib/fs-utils'
import { nanoid } from 'nanoid'

// ─── FileType Config ───────────────────────────────────────

interface FileTypeConfig {
  /** 확장자 매칭 함수 */
  matchExtension: (fileName: string) => boolean
  /** 확장자 제거한 제목 추출 */
  extractTitle: (fileName: string) => string
  /** Repository 참조 */
  repository: {
    findByRelativePath(workspaceId: string, relativePath: string): any
    create(data: any): any
    delete(id: string): void
    bulkDeleteByPrefix(workspaceId: string, prefix: string): void
    bulkUpdatePathPrefix(workspaceId: string, oldPrefix: string, newPrefix: string): void
    findByWorkspaceId(workspaceId: string): any[]
    createMany(items: any[]): void
    deleteOrphans(workspaceId: string, existingPaths: string[]): void
    update(id: string, data: any): any
  }
  /** IPC push 채널명 */
  channelName: string
  /** entity-link에서 사용할 타입 문자열 */
  entityType: 'note' | 'csv' | 'pdf' | 'image'
  /** 이벤트 필터 (Image의 .images/ 제외 등) */
  skipFilter?: (relativePath: string) => boolean
  /** 비동기 fs 스캔 함수 */
  readFilesAsync: (absBase: string, parentRel: string) => Promise<FileEntry[]>
}

const fileTypeConfigs: FileTypeConfig[] = [
  {
    matchExtension: (n) => n.endsWith('.md'),
    extractTitle: (n) => path.basename(n, '.md'),
    repository: noteRepository,
    channelName: 'note:changed',
    entityType: 'note',
    readFilesAsync: readMdFilesRecursiveAsync
  },
  {
    matchExtension: (n) => n.endsWith('.csv'),
    extractTitle: (n) => path.basename(n, '.csv'),
    repository: csvFileRepository,
    channelName: 'csv:changed',
    entityType: 'csv',
    readFilesAsync: readCsvFilesRecursiveAsync
  },
  {
    matchExtension: (n) => n.endsWith('.pdf'),
    extractTitle: (n) => path.basename(n, '.pdf'),
    repository: pdfFileRepository,
    channelName: 'pdf:changed',
    entityType: 'pdf',
    readFilesAsync: readPdfFilesRecursiveAsync
  },
  {
    matchExtension: isImageFile,
    extractTitle: (n) => path.basename(n, path.extname(n)),
    repository: imageFileRepository,
    channelName: 'image:changed',
    entityType: 'image',
    skipFilter: (rel) => rel.startsWith('.images/') || rel.includes('/.images/'),
    readFilesAsync: readImageFilesRecursiveAsync
  }
]

class WorkspaceWatcherService {
  private subscription: parcelWatcher.AsyncSubscription | null = null
  private activeWorkspaceId: string | null = null
  private activeWorkspacePath: string | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private pendingEvents: parcelWatcher.Event[] = []

  getActiveWorkspaceId(): string | null {
    return this.activeWorkspaceId
  }

  /**
   * watcher 없거나 다른 workspace → 전환
   */
  async ensureWatching(workspaceId: string, workspacePath: string): Promise<void> {
    if (this.activeWorkspaceId === workspaceId && this.activeWorkspacePath === workspacePath) return
    await this.stop()
    await this.start(workspaceId, workspacePath)
  }

  async start(workspaceId: string, workspacePath: string): Promise<void> {
    await this.syncOfflineChanges(workspaceId, workspacePath)

    // 각 파일 타입 초기 동기화 — try/catch: 실패해도 watcher는 정상 시작
    for (const config of fileTypeConfigs) {
      try {
        await this.reconcileFileType(workspaceId, workspacePath, config)
      } catch {
        /* ignore — watcher continues without initial sync */
      }
    }

    // 초기 동기화 완료 → renderer re-fetch
    this.pushChanged('folder:changed', workspaceId, [])
    for (const config of fileTypeConfigs) {
      this.pushChanged(config.channelName, workspaceId, [])
    }

    try {
      this.subscription = await parcelWatcher.subscribe(workspacePath, (err, events) => {
        if (err) return
        this.handleEvents(workspaceId, workspacePath, events)
      })
      this.activeWorkspaceId = workspaceId
      this.activeWorkspacePath = workspacePath
    } catch {
      // workspace 접근 불가 → watcher 없이 진행 (crash 방지)
    }
  }

  async stop(): Promise<void> {
    this.pendingEvents = []
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.subscription) {
      await this.subscription.unsubscribe()
      this.subscription = null
    }
    if (this.activeWorkspacePath) {
      try {
        await parcelWatcher.writeSnapshot(
          this.activeWorkspacePath,
          this.getSnapshotPath(this.activeWorkspaceId!)
        )
      } catch {
        /* ignore */
      }
    }
    this.activeWorkspaceId = null
    this.activeWorkspacePath = null
  }

  private async syncOfflineChanges(workspaceId: string, workspacePath: string): Promise<void> {
    const snapshotPath = this.getSnapshotPath(workspaceId)
    let events: parcelWatcher.Event[] = []

    if (fs.existsSync(snapshotPath)) {
      try {
        events = await parcelWatcher.getEventsSince(workspacePath, snapshotPath)
      } catch {
        try {
          await this.fullReconciliation(workspaceId, workspacePath)
        } catch {
          /* ignore — watcher continues without initial sync */
        }
        return
      }
    } else {
      try {
        await this.fullReconciliation(workspaceId, workspacePath)
      } catch {
        /* ignore — watcher continues without initial sync */
      }
      return
    }

    await this.applyEvents(workspaceId, workspacePath, events)

    try {
      await parcelWatcher.writeSnapshot(workspacePath, snapshotPath)
    } catch {
      /* ignore */
    }
  }

  private handleEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): void {
    this.pendingEvents.push(...events)
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(async () => {
      try {
        const eventsToProcess = this.pendingEvents.splice(0)
        const { folderPaths, orphanPaths } = await this.applyEvents(
          workspaceId,
          workspacePath,
          eventsToProcess
        )
        this.pushChanged('folder:changed', workspaceId, folderPaths)

        // 변경된 파일 경로 수집 + 폴더 삭제로 함께 삭제된 경로 병합
        for (const config of fileTypeConfigs) {
          const changedRelPaths = [
            ...eventsToProcess
              .filter((e) => {
                if (!config.matchExtension(e.path) || path.basename(e.path).startsWith('.'))
                  return false
                const rel = path.relative(workspacePath, e.path).replace(/\\/g, '/')
                return !config.skipFilter?.(rel)
              })
              .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/')),
            ...(orphanPaths.get(config.entityType) ?? [])
          ]
          this.pushChanged(config.channelName, workspaceId, changedRelPaths)
        }
      } catch {
        /* applyEvents 실패 시 무시 — watcher 지속 유지 */
      }
    }, 50)
  }

  /**
   * 이벤트 배치 → DB 동기화
   *
   * 처리 순서 (순서 중요):
   * 1. 폴더 rename/move 감지 → bulkUpdatePathPrefix (폴더 + 하위 파일)
   * 2. 나머지 폴더 이벤트 처리 (create/delete)
   * 3-14. 파일 타입별 rename/create/delete 처리
   */
  private async applyEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): Promise<{
    folderPaths: string[]
    orphanPaths: Map<string, string[]>
  }> {
    const changedFolderPaths: string[] = []
    const orphanPaths = new Map<string, string[]>(
      fileTypeConfigs.map((c) => [c.entityType, []])
    )

    // ─── Step 1: 폴더 rename/move 감지 ───────────────────────────
    const isFileEvent = (absPath: string): boolean =>
      fileTypeConfigs.some((c) => c.matchExtension(absPath))

    const nonFileDeletes = events.filter(
      (e) => e.type === 'delete' && !isFileEvent(e.path) && !path.basename(e.path).startsWith('.')
    )
    const nonFileCreates = events.filter(
      (e) => e.type === 'create' && !isFileEvent(e.path) && !path.basename(e.path).startsWith('.')
    )
    const pairedFolderDeletePaths = new Set<string>()
    const pairedFolderCreatePaths = new Set<string>()
    for (const createEvent of nonFileCreates) {
      const createParent = path.dirname(createEvent.path)
      const createBasename = path.basename(createEvent.path)
      const matchingDelete =
        nonFileDeletes.find(
          (d) => !pairedFolderDeletePaths.has(d.path) && path.dirname(d.path) === createParent
        ) ??
        nonFileDeletes.find(
          (d) => !pairedFolderDeletePaths.has(d.path) && path.basename(d.path) === createBasename
        )
      if (matchingDelete) {
        const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
        const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
        const existingFolder = folderRepository.findByRelativePath(workspaceId, oldRel)
        if (existingFolder) {
          folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
          for (const config of fileTypeConfigs) {
            config.repository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
          }
          pairedFolderDeletePaths.add(matchingDelete.path)
          pairedFolderCreatePaths.add(createEvent.path)
          changedFolderPaths.push(newRel)
        }
      }
    }

    // ─── Step 2: 나머지 폴더 이벤트 처리 (create / delete) ───────
    for (const event of events) {
      const absPath = event.path
      const rel = path.relative(workspacePath, absPath).replace(/\\/g, '/')
      const basename = path.basename(absPath)

      if (isFileEvent(absPath)) continue
      if (pairedFolderDeletePaths.has(absPath) || pairedFolderCreatePaths.has(absPath)) continue

      // getEventsSince rename + oldPath (플랫폼 의존적)
      if (
        'oldPath' in event &&
        typeof (event as unknown as { oldPath: string }).oldPath === 'string'
      ) {
        const oldRel = path
          .relative(workspacePath, (event as unknown as { oldPath: string }).oldPath)
          .replace(/\\/g, '/')
        folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
        for (const config of fileTypeConfigs) {
          config.repository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
        }
        changedFolderPaths.push(rel)
        continue
      }

      if (event.type === 'create') {
        try {
          const stat = await fs.promises.stat(absPath)
          if (!stat.isDirectory()) continue
        } catch {
          continue
        }
        if (basename.startsWith('.')) continue
        const existing = folderRepository.findByRelativePath(workspaceId, rel)
        if (!existing) {
          const now = new Date()
          folderRepository.create({
            id: nanoid(),
            workspaceId,
            relativePath: rel,
            color: null,
            order: 0,
            createdAt: now,
            updatedAt: now
          })
          changedFolderPaths.push(rel)
        }
        continue
      }

      if (event.type === 'delete') {
        const existing = folderRepository.findByRelativePath(workspaceId, rel)
        if (existing) {
          // 삭제 전 하위 파일 경로 수집 → changed 이벤트에 포함
          for (const config of fileTypeConfigs) {
            const children = config.repository
              .findByWorkspaceId(workspaceId)
              .filter((item: any) => item.relativePath.startsWith(rel + '/'))
            orphanPaths.get(config.entityType)!.push(
              ...children.map((item: any) => item.relativePath)
            )
            for (const child of children) {
              entityLinkRepository.removeAllByEntity(config.entityType, child.id)
            }
            config.repository.bulkDeleteByPrefix(workspaceId, rel)
          }
          folderRepository.bulkDeleteByPrefix(workspaceId, rel)
          changedFolderPaths.push(rel)
        }
        continue
      }
    }

    // ─── Steps 3+: 파일 타입별 rename/create/delete 처리 ────────
    for (const config of fileTypeConfigs) {
      await this.processFileTypeEvents(workspaceId, workspacePath, events, config)
    }

    return { folderPaths: changedFolderPaths, orphanPaths }
  }

  /**
   * 특정 파일 타입의 rename/create/delete 이벤트 처리
   */
  private async processFileTypeEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[],
    config: FileTypeConfig
  ): Promise<void> {
    const filterEvent = (e: parcelWatcher.Event, type: 'create' | 'delete'): boolean => {
      if (e.type !== type || !config.matchExtension(e.path) || path.basename(e.path).startsWith('.'))
        return false
      if (config.skipFilter) {
        const rel = path.relative(workspacePath, e.path).replace(/\\/g, '/')
        return !config.skipFilter(rel)
      }
      return true
    }

    const deletes = events.filter((e) => filterEvent(e, 'delete'))
    const creates = events.filter((e) => filterEvent(e, 'create'))
    const pairedDeletePaths = new Set<string>()
    const pairedCreatePaths = new Set<string>()

    // rename/move 감지
    for (const createEvent of creates) {
      const createDir = path.dirname(createEvent.path)
      const createBasename = path.basename(createEvent.path)
      const matchingDelete =
        deletes.find(
          (d) => !pairedDeletePaths.has(d.path) && path.dirname(d.path) === createDir
        ) ??
        deletes.find(
          (d) => !pairedDeletePaths.has(d.path) && path.basename(d.path) === createBasename
        )
      if (matchingDelete) {
        const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
        const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
        const existing = config.repository.findByRelativePath(workspaceId, oldRel)
        if (existing) {
          const newParentRel = newRel.includes('/')
            ? newRel.split('/').slice(0, -1).join('/')
            : null
          const newFolder = newParentRel
            ? folderRepository.findByRelativePath(workspaceId, newParentRel)
            : null
          config.repository.update(existing.id, {
            relativePath: newRel,
            folderId: newParentRel ? (newFolder?.id ?? existing.folderId) : null,
            title: config.extractTitle(createEvent.path),
            updatedAt: new Date()
          })
          pairedDeletePaths.add(matchingDelete.path)
          pairedCreatePaths.add(createEvent.path)
        }
      }
    }

    // standalone create
    for (const createEvent of creates) {
      if (pairedCreatePaths.has(createEvent.path)) continue
      const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
      const existing = config.repository.findByRelativePath(workspaceId, rel)
      if (!existing) {
        try {
          const stat = await fs.promises.stat(createEvent.path)
          if (!stat.isFile()) continue
        } catch {
          continue
        }
        const parentRel = rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : null
        const folder = parentRel
          ? folderRepository.findByRelativePath(workspaceId, parentRel)
          : null
        const now = new Date()
        config.repository.create({
          id: nanoid(),
          workspaceId,
          relativePath: rel,
          folderId: folder?.id ?? null,
          title: config.extractTitle(createEvent.path),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }

    // standalone delete
    for (const deleteEvent of deletes) {
      if (pairedDeletePaths.has(deleteEvent.path)) continue
      const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
      const existing = config.repository.findByRelativePath(workspaceId, rel)
      if (existing) {
        entityLinkRepository.removeAllByEntity(config.entityType, existing.id)
        config.repository.delete(existing.id)
      }
    }
  }

  /**
   * 특정 파일 타입의 FS ↔ DB 동기화 (reconciliation)
   */
  private async reconcileFileType(
    workspaceId: string,
    workspacePath: string,
    config: FileTypeConfig
  ): Promise<void> {
    const fsEntries = await config.readFilesAsync(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbRows = config.repository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbRows.map((r: any) => r.relativePath))

    const now = new Date()
    const toInsert = fsEntries
      .filter((e) => !dbPathSet.has(e.relativePath))
      .map((e) => {
        const parentRel = e.relativePath.includes('/')
          ? e.relativePath.split('/').slice(0, -1).join('/')
          : null
        const folder = parentRel
          ? folderRepository.findByRelativePath(workspaceId, parentRel)
          : null
        return {
          id: nanoid(),
          workspaceId,
          relativePath: e.relativePath,
          folderId: folder?.id ?? null,
          title: config.extractTitle(e.name),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        }
      })

    config.repository.createMany(toInsert)
    const fsPathSet = new Set(fsPaths)
    const orphanIds = config.repository
      .findByWorkspaceId(workspaceId)
      .filter((r: any) => !fsPathSet.has(r.relativePath))
      .map((r: any) => r.id)
    cleanupOrphansAndDelete(config.entityType, orphanIds, () =>
      config.repository.deleteOrphans(workspaceId, fsPaths)
    )
  }

  private async fullReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
    const fsEntries = await readDirRecursiveAsync(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbFolders = folderRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbFolders.map((f) => f.relativePath))

    const now = new Date()
    const toInsert = fsEntries
      .filter((e) => !dbPathSet.has(e.relativePath))
      .map((e) => ({
        id: nanoid(),
        workspaceId,
        relativePath: e.relativePath,
        color: null as null,
        order: 0,
        createdAt: now,
        updatedAt: now
      }))
    folderRepository.createMany(toInsert)
    folderRepository.deleteOrphans(workspaceId, fsPaths)
  }

  private pushChanged(channelName: string, workspaceId: string, changedRelPaths: string[]): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(channelName, workspaceId, changedRelPaths)
    })
  }

  private getSnapshotPath(workspaceId: string): string {
    const snapshotsDir = path.join(app.getPath('userData'), 'workspace-snapshots')
    fs.mkdirSync(snapshotsDir, { recursive: true })
    return path.join(snapshotsDir, `${workspaceId}.snapshot`)
  }
}

export const workspaceWatcher = new WorkspaceWatcherService()
