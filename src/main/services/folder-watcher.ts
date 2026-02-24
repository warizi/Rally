import * as parcelWatcher from '@parcel/watcher'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { folderRepository } from '../repositories/folder'
import { readDirRecursive } from './folder'
import { nanoid } from 'nanoid'

class FolderWatcherService {
  private subscription: parcelWatcher.AsyncSubscription | null = null
  private activeWorkspaceId: string | null = null
  private activeWorkspacePath: string | null = null
  private debounceTimer: NodeJS.Timeout | null = null

  /**
   * watcher 없거나 다른 workspace, 또는 path 변경 → 재시작
   * activeWorkspaceId와 activeWorkspacePath 모두 일치해야 early return
   */
  async ensureWatching(workspaceId: string, workspacePath: string): Promise<void> {
    if (this.activeWorkspaceId === workspaceId && this.activeWorkspacePath === workspacePath) return
    await this.stop()
    await this.start(workspaceId, workspacePath)
  }

  async start(workspaceId: string, workspacePath: string): Promise<void> {
    await this.syncOfflineChanges(workspaceId, workspacePath)

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
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.subscription) {
      await this.subscription.unsubscribe()
      this.subscription = null
    }
    // snapshot 저장 (best-effort)
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

  /** 앱 재시작 시 오프라인 변경사항 처리 */
  private async syncOfflineChanges(workspaceId: string, workspacePath: string): Promise<void> {
    const snapshotPath = this.getSnapshotPath(workspaceId)
    let events: parcelWatcher.Event[] = []

    if (fs.existsSync(snapshotPath)) {
      try {
        events = await parcelWatcher.getEventsSince(workspacePath, snapshotPath)
      } catch {
        // journal 만료 → full reconciliation
        await this.fullReconciliation(workspaceId, workspacePath)
        return
      }
    } else {
      // 첫 실행 또는 crash → full reconciliation
      await this.fullReconciliation(workspaceId, workspacePath)
      return
    }

    await this.applyEvents(workspaceId, workspacePath, events)

    // 새 snapshot 저장
    try {
      await parcelWatcher.writeSnapshot(workspacePath, snapshotPath)
    } catch {
      /* ignore */
    }
  }

  /** 실시간 이벤트 debounce 처리 */
  private handleEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(async () => {
      await this.applyEvents(workspaceId, workspacePath, events)
      this.pushChanged(workspaceId)
    }, 50)
  }

  /**
   * 이벤트 배치 → DB 동기화
   *
   * @parcel/watcher public EventType = 'create' | 'update' | 'delete'
   * 'rename' 이벤트는 공식 타입에 없음. getEventsSince 결과에서 플랫폼에 따라
   * 런타임에 oldPath 필드가 포함될 수 있으므로 방어적으로 체크.
   */
  private async applyEvents(
    workspaceId: string,
    workspacePath: string,
    events: parcelWatcher.Event[]
  ): Promise<void> {
    for (const event of events) {
      const absPath = event.path
      const rel = path.relative(workspacePath, absPath).replace(/\\/g, '/')

      // getEventsSince가 런타임에 rename + oldPath를 제공하는 경우 (플랫폼 의존적)
      if (
        'oldPath' in event &&
        typeof (event as unknown as { oldPath: string }).oldPath === 'string'
      ) {
        const oldRel = path
          .relative(workspacePath, (event as unknown as { oldPath: string }).oldPath)
          .replace(/\\/g, '/')
        folderRepository.bulkUpdatePathPrefix(workspaceId, oldRel, rel)
        continue
      }

      if (event.type === 'create') {
        try {
          const stat = await fs.promises.stat(absPath)
          if (!stat.isDirectory()) continue
        } catch {
          continue
        }
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
        }
        continue
      }

      if (event.type === 'delete') {
        const existing = folderRepository.findByRelativePath(workspaceId, rel)
        if (existing) {
          folderRepository.bulkDeleteByPrefix(workspaceId, rel)
        }
        continue
      }
    }
  }

  /** fs vs DB 전체 비교 동기화 */
  private async fullReconciliation(workspaceId: string, workspacePath: string): Promise<void> {
    const fsEntries = readDirRecursive(workspacePath, '')
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

  private getSnapshotPath(workspaceId: string): string {
    const snapshotsDir = path.join(app.getPath('userData'), 'folder-snapshots')
    fs.mkdirSync(snapshotsDir, { recursive: true })
    return path.join(snapshotsDir, `${workspaceId}.snapshot`)
  }

  private pushChanged(workspaceId: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('folder:changed', workspaceId)
    })
  }
}

export const folderWatcher = new FolderWatcherService()
