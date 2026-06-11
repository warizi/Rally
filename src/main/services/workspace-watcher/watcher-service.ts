import * as parcelWatcher from '@parcel/watcher'
import fs from 'fs'
import { BrowserWindow } from 'electron'
import { fileTypeConfigs } from './file-type-config'
import { applyEvents } from './event-processor'
import { syncOfflineChanges, reconcileWorkspace, getSnapshotPath } from './reconciler'
import { isRecentWrite } from '../../lib/recent-writes'
import { isHiddenRelPath, toWorkspaceRel } from '../../lib/fs-utils'
import { scoped } from '../../lib/logger'

const log = scoped('watcher')

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
    // R-01·R-12: 워크스페이스 루트 접근성 선검사 — 미마운트 외장 볼륨·TCC 권한 거부
    // 상태에서 reconcile 이 "빈 스캔 = 전부 삭제됨" 으로 오판해 레코드·링크를
    // 파괴하는 경로를 차단한다. 접근 불가 시 reconcile 전체를 보류한다.
    let rootAccessible = true
    try {
      await fs.promises.readdir(workspacePath)
    } catch (err) {
      rootAccessible = false
      log.warn(`workspace 루트 접근 불가 — reconcile 보류: ${workspacePath} (${String(err)})`)
    }

    if (rootAccessible) {
      // 스냅샷 diff 이벤트 재생 (fast-path) → 풀 reconcile (P1: 폴더 포함 매 기동)
      await syncOfflineChanges(workspaceId, workspacePath)
      try {
        await reconcileWorkspace(workspaceId, workspacePath)
      } catch (err) {
        log.warn(`reconcileWorkspace 실패 — 초기 동기화 없이 진행: ${String(err)}`)
      }

      // 초기 동기화 완료 → renderer re-fetch
      this.pushChanged('folder:changed', workspaceId, [])
      for (const config of fileTypeConfigs) {
        this.pushChanged(config.channelName, workspaceId, [])
      }
    }

    try {
      this.subscription = await parcelWatcher.subscribe(workspacePath, (err, events) => {
        if (err) {
          log.warn(`watcher 이벤트 콜백 오류: ${String(err)}`)
          return
        }
        this.handleEvents(workspaceId, workspacePath, events)
      })
      this.activeWorkspaceId = workspaceId
      this.activeWorkspacePath = workspacePath
    } catch (err) {
      // workspace 접근 불가 → watcher 없이 진행 (crash 방지)
      log.warn(`watcher subscribe 실패 — 감시 없이 진행: ${workspacePath} (${String(err)})`)
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
      } catch (err) {
        log.warn(`stop 시 writeSnapshot 실패 — 다음 기동은 풀스캔으로 대체됨: ${String(err)}`)
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
                if (!config.matchExtension(e.path)) return false
                // R-08: leaf basename 만이 아닌 모든 세그먼트의 숨김(.) 여부 검사 — 스캔 규칙과 통일
                const rel = toWorkspaceRel(workspacePath, e.path)
                if (isHiddenRelPath(rel)) return false
                return !config.skipFilter?.(rel)
              })
              .map((e) => toWorkspaceRel(workspacePath, e.path)),
            ...(orphanPaths.get(config.entityType) ?? [])
          ]
          // MCP 라우트 같은 main-process 내부 변경은 이미 broadcastChanged 로 broadcast 됐다.
          // recent-writes 트래커에 등록된 path 는 여기서 skip 해 이중 알림을 방지한다.
          const dedupedPaths = changedRelPaths.filter((rel) => !isRecentWrite(workspaceId, rel))
          // 전부 dedup 된 경우 broadcast 자체를 생략 (불필요한 invalidation 도 줄임)
          if (dedupedPaths.length === 0 && changedRelPaths.length > 0) continue
          this.pushChanged(config.channelName, workspaceId, dedupedPaths)
        }
      } catch (err) {
        // applyEvents 실패 시 throw 전파 없이 watcher 지속 유지 (계약 C7)
        // 단, 배치가 통째로 유실되므로 반드시 흔적을 남긴다 (R-05)
        log.error(`이벤트 배치 처리 실패 — 배치 유실: ${String(err)}`)
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
