import * as parcelWatcher from '@parcel/watcher'
import path from 'path'
import { BrowserWindow } from 'electron'
import { fileTypeConfigs } from './file-type-config'
import { applyEvents } from './event-processor'
import { syncOfflineChanges, reconcileFileType, getSnapshotPath } from './reconciler'
import { isRecentWrite } from '../../lib/recent-writes'

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
    await syncOfflineChanges(workspaceId, workspacePath)

    // 각 파일 타입 초기 동기화 — try/catch: 실패해도 watcher는 정상 시작
    for (const config of fileTypeConfigs) {
      try {
        await reconcileFileType(workspaceId, workspacePath, config)
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
          getSnapshotPath(this.activeWorkspaceId!)
        )
      } catch {
        /* ignore */
      }
    }
    this.activeWorkspaceId = null
    this.activeWorkspacePath = null
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
        const { folderPaths, orphanPaths } = await applyEvents(
          workspaceId,
          workspacePath,
          eventsToProcess
        )
        // folder 도 dedup — MCP folders 라우트가 이미 broadcast 한 path 는 skip
        const dedupedFolderPaths = folderPaths.filter((rel) => !isRecentWrite(workspaceId, rel))
        if (dedupedFolderPaths.length > 0 || folderPaths.length === 0) {
          this.pushChanged('folder:changed', workspaceId, dedupedFolderPaths)
        }

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
          // MCP 라우트 같은 main-process 내부 변경은 이미 broadcastChanged 로 broadcast 됐다.
          // recent-writes 트래커에 등록된 path 는 여기서 skip 해 이중 알림을 방지한다.
          const dedupedPaths = changedRelPaths.filter((rel) => !isRecentWrite(workspaceId, rel))
          // 전부 dedup 된 경우 broadcast 자체를 생략 (불필요한 invalidation 도 줄임)
          if (dedupedPaths.length === 0 && changedRelPaths.length > 0) continue
          this.pushChanged(config.channelName, workspaceId, dedupedPaths)
        }
      } catch {
        /* applyEvents 실패 시 무시 — watcher 지속 유지 */
      }
    }, 50)
  }

  private pushChanged(channelName: string, workspaceId: string, changedRelPaths: string[]): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(channelName, workspaceId, changedRelPaths)
    })
  }
}

export const workspaceWatcher = new WorkspaceWatcherService()
