import * as parcelWatcher from '@parcel/watcher'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { folderRepository } from '../repositories/folder'
import { noteRepository } from '../repositories/note'
import { csvFileRepository } from '../repositories/csv-file'
import { pdfFileRepository } from '../repositories/pdf-file'
import { readDirRecursiveAsync } from './folder'
import {
  readMdFilesRecursiveAsync,
  readCsvFilesRecursiveAsync,
  readPdfFilesRecursiveAsync
} from '../lib/fs-utils'
import { nanoid } from 'nanoid'

class WorkspaceWatcherService {
  private subscription: parcelWatcher.AsyncSubscription | null = null
  private activeWorkspaceId: string | null = null
  private activeWorkspacePath: string | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private pendingEvents: parcelWatcher.Event[] = []

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

    // note + csv 초기 동기화 — try/catch: 실패해도 watcher는 정상 시작
    try {
      await this.noteReconciliation(workspaceId, workspacePath)
    } catch {
      /* ignore — watcher continues without initial note sync */
    }
    try {
      await this.csvReconciliation(workspaceId, workspacePath)
    } catch {
      /* ignore — watcher continues without initial csv sync */
    }
    try {
      await this.pdfReconciliation(workspaceId, workspacePath)
    } catch {
      /* ignore — watcher continues without initial pdf sync */
    }

    // 초기 동기화 완료 → renderer re-fetch
    this.pushFolderChanged(workspaceId, [])
    this.pushNoteChanged(workspaceId, [])
    this.pushCsvChanged(workspaceId, [])
    this.pushPdfChanged(workspaceId, [])

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
        const { folderPaths, orphanNotePaths, orphanCsvPaths, orphanPdfPaths } = await this.applyEvents(
          workspaceId,
          workspacePath,
          eventsToProcess
        )
        this.pushFolderChanged(workspaceId, folderPaths)
        // 변경된 .md 파일 경로 수집 + 폴더 삭제로 함께 삭제된 노트 경로 병합
        const changedRelPaths = [
          ...eventsToProcess
            .filter((e) => e.path.endsWith('.md') && !path.basename(e.path).startsWith('.'))
            .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/')),
          ...orphanNotePaths
        ]
        this.pushNoteChanged(workspaceId, changedRelPaths)
        // 변경된 .csv 파일 경로 수집 + 폴더 삭제로 함께 삭제된 CSV 경로 병합
        const changedCsvRelPaths = [
          ...eventsToProcess
            .filter((e) => e.path.endsWith('.csv') && !path.basename(e.path).startsWith('.'))
            .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/')),
          ...orphanCsvPaths
        ]
        this.pushCsvChanged(workspaceId, changedCsvRelPaths)
        // 변경된 .pdf 파일 경로 수집 + 폴더 삭제로 함께 삭제된 PDF 경로 병합
        const changedPdfRelPaths = [
          ...eventsToProcess
            .filter((e) => e.path.endsWith('.pdf') && !path.basename(e.path).startsWith('.'))
            .map((e) => path.relative(workspacePath, e.path).replace(/\\/g, '/')),
          ...orphanPdfPaths
        ]
        this.pushPdfChanged(workspaceId, changedPdfRelPaths)
      } catch {
        /* applyEvents 실패 시 무시 — watcher 지속 유지 */
      }
    }, 50)
  }

  /**
   * 이벤트 배치 → DB 동기화
   *
   * 처리 순서 (순서 중요):
   * 1. 폴더 rename/move 감지 → bulkUpdatePathPrefix (폴더 + 하위 노트)
   * 2. 나머지 폴더 이벤트 처리 (create/delete)
   * 3. .md 파일 rename/move 감지 → noteRepository.update + folderId 갱신
   *    (폴더 처리 완료 후 실행해야 새 폴더 ID 조회 가능)
   */
  private async applyEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): Promise<{
    folderPaths: string[]
    orphanNotePaths: string[]
    orphanCsvPaths: string[]
    orphanPdfPaths: string[]
  }> {
    /** 실제 폴더 변경이 발생한 relative path 수집 (toast용) */
    const changedFolderPaths: string[] = []
    /** 폴더 삭제로 함께 삭제된 노트/CSV/PDF 경로 (watcher 이벤트 보완용) */
    const orphanNotePaths: string[] = []
    const orphanCsvPaths: string[] = []
    const orphanPdfPaths: string[] = []
    // ─── Step 1: 폴더 rename/move 감지 ───────────────────────────
    // 같은 부모(이름 변경) 또는 같은 폴더명(위치 이동)의 delete+create 쌍
    const nonMdDeletes = events.filter(
      (e) =>
        e.type === 'delete' && !e.path.endsWith('.md') && !path.basename(e.path).startsWith('.')
    )
    const nonMdCreates = events.filter(
      (e) =>
        e.type === 'create' && !e.path.endsWith('.md') && !path.basename(e.path).startsWith('.')
    )
    const pairedFolderDeletePaths = new Set<string>()
    const pairedFolderCreatePaths = new Set<string>()
    for (const createEvent of nonMdCreates) {
      const createParent = path.dirname(createEvent.path)
      const createBasename = path.basename(createEvent.path)
      // 1차: 같은 부모 (이름 변경), 2차: 같은 폴더명 (위치 이동)
      const matchingDelete =
        nonMdDeletes.find(
          (d) => !pairedFolderDeletePaths.has(d.path) && path.dirname(d.path) === createParent
        ) ??
        nonMdDeletes.find(
          (d) => !pairedFolderDeletePaths.has(d.path) && path.basename(d.path) === createBasename
        )
      if (matchingDelete) {
        const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
        const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
        const existingFolder = folderRepository.findByRelativePath(workspaceId, oldRel)
        if (existingFolder) {
          folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
          noteRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
          csvFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
          pdfFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, newRel)
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

      if (absPath.endsWith('.md')) continue
      if (absPath.endsWith('.csv')) continue
      if (absPath.endsWith('.pdf')) continue
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
        noteRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
        csvFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
        pdfFileRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
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
          // 삭제 전 하위 노트/CSV 경로 수집 → changed 이벤트에 포함
          const childNotes = noteRepository
            .findByWorkspaceId(workspaceId)
            .filter((n) => n.relativePath.startsWith(rel + '/'))
          const childCsvs = csvFileRepository
            .findByWorkspaceId(workspaceId)
            .filter((c) => c.relativePath.startsWith(rel + '/'))
          const childPdfs = pdfFileRepository
            .findByWorkspaceId(workspaceId)
            .filter((p) => p.relativePath.startsWith(rel + '/'))
          orphanNotePaths.push(...childNotes.map((n) => n.relativePath))
          orphanCsvPaths.push(...childCsvs.map((c) => c.relativePath))
          orphanPdfPaths.push(...childPdfs.map((p) => p.relativePath))

          noteRepository.bulkDeleteByPrefix(workspaceId, rel)
          csvFileRepository.bulkDeleteByPrefix(workspaceId, rel)
          pdfFileRepository.bulkDeleteByPrefix(workspaceId, rel)
          folderRepository.bulkDeleteByPrefix(workspaceId, rel)
          changedFolderPaths.push(rel)
        }
        continue
      }
    }

    // ─── Step 3: .md 파일 rename/move 감지 ───────────────────────
    // 폴더 처리 완료 후 실행 → 새 폴더 ID 조회 가능
    // 기존 note ID를 유지하며 relativePath / folderId / title 업데이트 → 탭 연결 유지
    const mdDeletes = events.filter(
      (e) => e.type === 'delete' && e.path.endsWith('.md') && !path.basename(e.path).startsWith('.')
    )
    const mdCreates = events.filter(
      (e) => e.type === 'create' && e.path.endsWith('.md') && !path.basename(e.path).startsWith('.')
    )
    const pairedMdDeletePaths = new Set<string>()
    const pairedMdCreatePaths = new Set<string>()
    for (const createEvent of mdCreates) {
      const createDir = path.dirname(createEvent.path)
      const createBasename = path.basename(createEvent.path)
      // 1차: 같은 디렉토리 (이름 변경), 2차: 같은 파일명 (다른 폴더로 이동)
      const matchingDelete =
        mdDeletes.find(
          (d) => !pairedMdDeletePaths.has(d.path) && path.dirname(d.path) === createDir
        ) ??
        mdDeletes.find(
          (d) => !pairedMdDeletePaths.has(d.path) && path.basename(d.path) === createBasename
        )
      if (matchingDelete) {
        const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
        const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
        const existing = noteRepository.findByRelativePath(workspaceId, oldRel)
        if (existing) {
          // 새 경로의 부모 폴더 ID 조회 (Step 2에서 신규 폴더도 DB에 등록됨)
          const newParentRel = newRel.includes('/')
            ? newRel.split('/').slice(0, -1).join('/')
            : null
          const newFolder = newParentRel
            ? folderRepository.findByRelativePath(workspaceId, newParentRel)
            : null
          noteRepository.update(existing.id, {
            relativePath: newRel,
            folderId: newParentRel ? (newFolder?.id ?? existing.folderId) : null,
            title: path.basename(createEvent.path, '.md'),
            updatedAt: new Date()
          })
          pairedMdDeletePaths.add(matchingDelete.path)
          pairedMdCreatePaths.add(createEvent.path)
        }
      }
    }

    // ─── Step 4: standalone MD create → DB에 note 추가 ──────────
    for (const createEvent of mdCreates) {
      if (pairedMdCreatePaths.has(createEvent.path)) continue
      const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
      const existing = noteRepository.findByRelativePath(workspaceId, rel)
      if (!existing) {
        // 50ms 디바운스 윈도우 내에 create → delete/rename이 발생하면 파일이 사라질 수 있음
        try {
          const stat = await fs.promises.stat(createEvent.path)
          if (!stat.isFile()) continue
        } catch {
          continue // 파일이 이미 없음 (디바운스 윈도우 내 삭제/이름 변경)
        }
        const parentRel = rel.includes('/') ? rel.split('/').slice(0, -1).join('/') : null
        const folder = parentRel
          ? folderRepository.findByRelativePath(workspaceId, parentRel)
          : null
        const now = new Date()
        noteRepository.create({
          id: nanoid(),
          workspaceId,
          relativePath: rel,
          folderId: folder?.id ?? null,
          title: path.basename(createEvent.path, '.md'),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }

    // ─── Step 5: standalone MD delete → DB에서 note 삭제 ────────
    for (const deleteEvent of mdDeletes) {
      if (pairedMdDeletePaths.has(deleteEvent.path)) continue
      const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
      const existing = noteRepository.findByRelativePath(workspaceId, rel)
      if (existing) {
        noteRepository.delete(existing.id)
      }
    }

    // ─── Step 6: .csv 파일 rename/move 감지 ──────────────────────
    const csvDeletes = events.filter(
      (e) =>
        e.type === 'delete' && e.path.endsWith('.csv') && !path.basename(e.path).startsWith('.')
    )
    const csvCreates = events.filter(
      (e) =>
        e.type === 'create' && e.path.endsWith('.csv') && !path.basename(e.path).startsWith('.')
    )
    const pairedCsvDeletePaths = new Set<string>()
    const pairedCsvCreatePaths = new Set<string>()
    for (const createEvent of csvCreates) {
      const createDir = path.dirname(createEvent.path)
      const createBasename = path.basename(createEvent.path)
      const matchingDelete =
        csvDeletes.find(
          (d) => !pairedCsvDeletePaths.has(d.path) && path.dirname(d.path) === createDir
        ) ??
        csvDeletes.find(
          (d) => !pairedCsvDeletePaths.has(d.path) && path.basename(d.path) === createBasename
        )
      if (matchingDelete) {
        const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
        const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
        const existing = csvFileRepository.findByRelativePath(workspaceId, oldRel)
        if (existing) {
          const newParentRel = newRel.includes('/')
            ? newRel.split('/').slice(0, -1).join('/')
            : null
          const newFolder = newParentRel
            ? folderRepository.findByRelativePath(workspaceId, newParentRel)
            : null
          csvFileRepository.update(existing.id, {
            relativePath: newRel,
            folderId: newParentRel ? (newFolder?.id ?? existing.folderId) : null,
            title: path.basename(createEvent.path, '.csv'),
            updatedAt: new Date()
          })
          pairedCsvDeletePaths.add(matchingDelete.path)
          pairedCsvCreatePaths.add(createEvent.path)
        }
      }
    }

    // ─── Step 7: standalone CSV create → DB에 csv 추가 ──────────
    for (const createEvent of csvCreates) {
      if (pairedCsvCreatePaths.has(createEvent.path)) continue
      const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
      const existing = csvFileRepository.findByRelativePath(workspaceId, rel)
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
        csvFileRepository.create({
          id: nanoid(),
          workspaceId,
          relativePath: rel,
          folderId: folder?.id ?? null,
          title: path.basename(createEvent.path, '.csv'),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }

    // ─── Step 8: standalone CSV delete → DB에서 csv 삭제 ────────
    for (const deleteEvent of csvDeletes) {
      if (pairedCsvDeletePaths.has(deleteEvent.path)) continue
      const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
      const existing = csvFileRepository.findByRelativePath(workspaceId, rel)
      if (existing) {
        csvFileRepository.delete(existing.id)
      }
    }

    // ─── Step 9: .pdf 파일 rename/move 감지 ──────────────────────
    const pdfDeletes = events.filter(
      (e) =>
        e.type === 'delete' && e.path.endsWith('.pdf') && !path.basename(e.path).startsWith('.')
    )
    const pdfCreates = events.filter(
      (e) =>
        e.type === 'create' && e.path.endsWith('.pdf') && !path.basename(e.path).startsWith('.')
    )
    const pairedPdfDeletePaths = new Set<string>()
    const pairedPdfCreatePaths = new Set<string>()
    for (const createEvent of pdfCreates) {
      const createDir = path.dirname(createEvent.path)
      const createBasename = path.basename(createEvent.path)
      const matchingDelete =
        pdfDeletes.find(
          (d) => !pairedPdfDeletePaths.has(d.path) && path.dirname(d.path) === createDir
        ) ??
        pdfDeletes.find(
          (d) => !pairedPdfDeletePaths.has(d.path) && path.basename(d.path) === createBasename
        )
      if (matchingDelete) {
        const oldRel = path.relative(workspacePath, matchingDelete.path).replace(/\\/g, '/')
        const newRel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
        const existing = pdfFileRepository.findByRelativePath(workspaceId, oldRel)
        if (existing) {
          const newParentRel = newRel.includes('/')
            ? newRel.split('/').slice(0, -1).join('/')
            : null
          const newFolder = newParentRel
            ? folderRepository.findByRelativePath(workspaceId, newParentRel)
            : null
          pdfFileRepository.update(existing.id, {
            relativePath: newRel,
            folderId: newParentRel ? (newFolder?.id ?? existing.folderId) : null,
            title: path.basename(createEvent.path, '.pdf'),
            updatedAt: new Date()
          })
          pairedPdfDeletePaths.add(matchingDelete.path)
          pairedPdfCreatePaths.add(createEvent.path)
        }
      }
    }

    // ─── Step 10: standalone PDF create → DB에 pdf 추가 ──────────
    for (const createEvent of pdfCreates) {
      if (pairedPdfCreatePaths.has(createEvent.path)) continue
      const rel = path.relative(workspacePath, createEvent.path).replace(/\\/g, '/')
      const existing = pdfFileRepository.findByRelativePath(workspaceId, rel)
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
        pdfFileRepository.create({
          id: nanoid(),
          workspaceId,
          relativePath: rel,
          folderId: folder?.id ?? null,
          title: path.basename(createEvent.path, '.pdf'),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        })
      }
    }

    // ─── Step 11: standalone PDF delete → DB에서 pdf 삭제 ────────
    for (const deleteEvent of pdfDeletes) {
      if (pairedPdfDeletePaths.has(deleteEvent.path)) continue
      const rel = path.relative(workspacePath, deleteEvent.path).replace(/\\/g, '/')
      const existing = pdfFileRepository.findByRelativePath(workspaceId, rel)
      if (existing) {
        pdfFileRepository.delete(existing.id)
      }
    }

    return { folderPaths: changedFolderPaths, orphanNotePaths, orphanCsvPaths, orphanPdfPaths }
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

  private async noteReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
    const fsEntries = await readMdFilesRecursiveAsync(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbNotes = noteRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbNotes.map((n) => n.relativePath))

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
          title: e.name.replace(/\.md$/, ''),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        }
      })

    noteRepository.createMany(toInsert)
    noteRepository.deleteOrphans(workspaceId, fsPaths)
  }

  private async csvReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
    const fsEntries = await readCsvFilesRecursiveAsync(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbCsvs = csvFileRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbCsvs.map((c) => c.relativePath))

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
          title: e.name.replace(/\.csv$/, ''),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        }
      })

    csvFileRepository.createMany(toInsert)
    csvFileRepository.deleteOrphans(workspaceId, fsPaths)
  }

  private getSnapshotPath(workspaceId: string): string {
    const snapshotsDir = path.join(app.getPath('userData'), 'workspace-snapshots')
    fs.mkdirSync(snapshotsDir, { recursive: true })
    return path.join(snapshotsDir, `${workspaceId}.snapshot`)
  }

  private pushFolderChanged(workspaceId: string, changedRelPaths: string[]): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('folder:changed', workspaceId, changedRelPaths)
    })
  }

  private pushNoteChanged(workspaceId: string, changedRelPaths: string[]): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('note:changed', workspaceId, changedRelPaths)
    })
  }

  private pushCsvChanged(workspaceId: string, changedRelPaths: string[]): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('csv:changed', workspaceId, changedRelPaths)
    })
  }

  private async pdfReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
    const fsEntries = await readPdfFilesRecursiveAsync(workspacePath, '')
    const fsPaths = fsEntries.map((e) => e.relativePath)

    const dbPdfs = pdfFileRepository.findByWorkspaceId(workspaceId)
    const dbPathSet = new Set(dbPdfs.map((p) => p.relativePath))

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
          title: e.name.replace(/\.pdf$/, ''),
          description: '',
          preview: '',
          order: 0,
          createdAt: now,
          updatedAt: now
        }
      })

    pdfFileRepository.createMany(toInsert)
    pdfFileRepository.deleteOrphans(workspaceId, fsPaths)
  }

  private pushPdfChanged(workspaceId: string, changedRelPaths: string[]): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('pdf:changed', workspaceId, changedRelPaths)
    })
  }
}

export const workspaceWatcher = new WorkspaceWatcherService()
