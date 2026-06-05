import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { setupAppMenu } from './bootstrap/app-menu'
import { createWindow } from './bootstrap/main-window'
import { runStartup } from './bootstrap/startup'
import { registerAllIpcHandlers } from './bootstrap/register-ipc'
import { registerLifecycleShutdown } from './bootstrap/shutdown'
import { startMcpApiServer } from './mcp-api/server'
import { setupAutoUpdater } from './lib/updater'
import { reminderScheduler } from './services/reminder-scheduler'
import { trashSweeper } from './services/trash/trash-sweeper'

/**
 * 메인 프로세스 진입점 — 부트스트랩 orchestration 전용.
 * 책임별 모듈: bootstrap/{app-menu, main-window, register-ipc, startup, shutdown}.
 */
app.whenReady().then(() => {
  app.setName('Rally')
  electronApp.setAppUserModelId('com.jin.rally')
  setupAppMenu()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 1) DB/워크스페이스 초기화 → 2) IPC 등록 → 3) MCP 서버 → 4) 윈도우 생성.
  runStartup()
  registerAllIpcHandlers()
  startMcpApiServer()
  createWindow()

  setupAutoUpdater()
  reminderScheduler.start()
  trashSweeper.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

registerLifecycleShutdown()
