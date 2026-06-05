import { app, session } from 'electron'
import { reminderScheduler } from '../services/reminder-scheduler'
import { trashSweeper } from '../services/trash/trash-sweeper'
import { workspaceWatcher } from '../services/workspace-watcher'
import { terminalService } from '../services/terminal'
import { stopMcpApiServer } from '../mcp-api/server'

/**
 * 앱 종료 lifecycle 핸들러 등록.
 * - window-all-closed: macOS 외에는 종료.
 * - before-quit: scheduler/sweeper/terminal/MCP 정리 + storage flush 후 watcher stop.
 */
export function registerLifecycleShutdown(): void {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // snapshot 저장은 async이므로 preventDefault + 1초 타임아웃으로 완료를 기다림
  // isQuitting 가드: app.quit() 재호출 시 무한 루프 방지
  let isQuitting = false
  app.on('before-quit', (event) => {
    if (isQuitting) return
    event.preventDefault()
    isQuitting = true
    reminderScheduler.stop()
    trashSweeper.stop()
    terminalService.destroyAllSessions()
    stopMcpApiServer()
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1000))
    // localStorage 등 Web Storage를 디스크에 flush한 뒤 종료
    session.defaultSession.flushStorageData()
    Promise.race([workspaceWatcher.stop(), timeout]).finally(() => app.quit())
  })
}
