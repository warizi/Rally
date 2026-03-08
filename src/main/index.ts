import { app, shell, BrowserWindow, ipcMain, screen, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import icon from '../../resources/icon.png?asset'
import { db } from './db'
import { registerWorkspaceHandlers } from './ipc/workspace'
import { registerTabSessionHandlers } from './ipc/tab-session'
import { registerTabSnapshotHandlers } from './ipc/tab-snapshot'
import { registerFolderHandlers } from './ipc/folder'
import { registerNoteHandlers } from './ipc/note'
import { registerTodoHandlers } from './ipc/todo'
import { registerCsvFileHandlers } from './ipc/csv-file'
import { registerPdfFileHandlers } from './ipc/pdf-file'
import { registerImageFileHandlers } from './ipc/image-file'
import { registerAppSettingsHandlers } from './ipc/app-settings'
import { registerScheduleHandlers } from './ipc/schedule'
import { registerEntityLinkHandlers } from './ipc/entity-link'
import { registerCanvasHandlers } from './ipc/canvas'
import { registerCanvasNodeHandlers } from './ipc/canvas-node'
import { registerCanvasEdgeHandlers } from './ipc/canvas-edge'
import { registerNoteImageHandlers } from './ipc/note-image'
import { registerReminderHandlers } from './ipc/reminder'
import { registerTagHandlers } from './ipc/tag'
import { registerItemTagHandlers } from './ipc/item-tag'
import { registerTerminalHandlers } from './ipc/terminal'
import { reminderScheduler } from './services/reminder-scheduler'
import { workspaceWatcher } from './services/workspace-watcher'
import { workspaceService } from './services/workspace'
import { terminalService } from './services/terminal'
import { startMcpApiServer, stopMcpApiServer } from './mcp-api/server'
import { registerAppInfoHandlers } from './ipc/app-info'
import { registerBackupHandlers } from './ipc/backup'

function runMigrations(): void {
  const migrationsFolder = is.dev
    ? join(process.cwd(), 'src/main/db/migrations')
    : join(process.resourcesPath, 'migrations')
  migrate(db, { migrationsFolder })
}

function initializeDatabase(): void {
  const workspaces = workspaceService.getAll()
  if (workspaces.length === 0) {
    const defaultPath = join(app.getPath('documents'), 'Rally', '기본 워크스페이스')
    workspaceService.create('기본 워크스페이스', defaultPath)
  }
}

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const mainWindow = new BrowserWindow({
    width,
    height,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 10 } }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools({ mode: 'right' })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  runMigrations()
  initializeDatabase()
  registerWorkspaceHandlers()
  registerTabSessionHandlers()
  registerTabSnapshotHandlers()
  registerFolderHandlers()
  registerNoteHandlers()
  registerTodoHandlers()
  registerCsvFileHandlers()
  registerPdfFileHandlers()
  registerImageFileHandlers()
  registerAppSettingsHandlers()
  registerScheduleHandlers()
  registerEntityLinkHandlers()
  registerCanvasHandlers()
  registerCanvasNodeHandlers()
  registerCanvasEdgeHandlers()
  registerNoteImageHandlers()
  registerReminderHandlers()
  registerTagHandlers()
  registerItemTagHandlers()
  registerTerminalHandlers()
  registerAppInfoHandlers()
  registerBackupHandlers()

  startMcpApiServer()

  createWindow()

  reminderScheduler.start()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

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
  terminalService.destroy()
  stopMcpApiServer()
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1000))
  // localStorage 등 Web Storage를 디스크에 flush한 뒤 종료
  session.defaultSession.flushStorageData()
  Promise.race([workspaceWatcher.stop(), timeout]).finally(() => app.quit())
})
