import { app, shell, BrowserWindow, ipcMain, screen, session } from 'electron'
import { dirname, join } from 'path'
import { existsSync, mkdirSync, renameSync } from 'fs'
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
import { registerRecurringRuleHandlers } from './ipc/recurring-rule'
import { registerRecurringCompletionHandlers } from './ipc/recurring-completion'
import { setupAutoUpdater } from './lib/updater'
import { ensureClaudeCommands } from './services/claude-commands-setup'

function runMigrations(): void {
  const migrationsFolder = is.dev
    ? join(process.cwd(), 'src/main/db/migrations')
    : join(process.resourcesPath, 'migrations')
  migrate(db, { migrationsFolder })
}

function initializeDatabase(): void {
  const workspaces = workspaceService.getAll()
  if (workspaces.length === 0) {
    const defaultPath = join(app.getPath('home'), 'Rally', '기본 워크스페이스')
    workspaceService.create('기본 워크스페이스', defaultPath)
  }
}

function ensureAllWorkspaceCommands(): void {
  const workspaces = workspaceService.getAll()
  for (const ws of workspaces) {
    ensureClaudeCommands(ws.path)
  }
}

// macOS TCC가 ~/Documents를 보호하면서 발생하던 EPERM을 해결하기 위해
// 기본 워크스페이스 위치를 ~/Documents/Rally → ~/Rally로 이동시킨다.
// 사용자가 직접 설정한 경로는 건드리지 않고, 정확히 옛 기본 경로를 쓰는 워크스페이스만 대상.
function migrateLegacyDefaultWorkspacePath(): void {
  const legacyPath = join(app.getPath('documents'), 'Rally', '기본 워크스페이스')
  const newPath = join(app.getPath('home'), 'Rally', '기본 워크스페이스')
  if (legacyPath === newPath) return

  const all = workspaceService.getAll()
  const target = all.find((ws) => ws.path === legacyPath)
  if (!target) return

  if (all.some((ws) => ws.id !== target.id && ws.path === newPath)) {
    console.warn(
      `[migrate-default-path] another workspace already uses ${newPath}; skipping migration`
    )
    return
  }

  try {
    mkdirSync(dirname(newPath), { recursive: true })
  } catch (err) {
    console.warn(`[migrate-default-path] cannot create parent dir for ${newPath}:`, err)
    return
  }

  if (!existsSync(newPath)) {
    let moved = false
    try {
      renameSync(legacyPath, newPath)
      moved = true
      console.log(`[migrate-default-path] moved ${legacyPath} → ${newPath}`)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      console.warn(
        `[migrate-default-path] cannot move legacy dir (${code}); creating fresh dir. ` +
          `Existing data (if any) remains at ${legacyPath}.`
      )
    }

    if (!moved) {
      try {
        mkdirSync(newPath, { recursive: true })
      } catch (err) {
        console.warn(`[migrate-default-path] cannot create ${newPath}:`, err)
        return
      }
    }
  }

  try {
    workspaceService.update(target.id, { path: newPath })
    console.log(
      `[migrate-default-path] updated workspace ${target.id} path: ${legacyPath} → ${newPath}`
    )
  } catch (err) {
    console.warn(`[migrate-default-path] failed to update workspace path in DB:`, err)
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
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    if (/^https?:\/\//.test(url)) {
      await shell.openExternal(url)
    }
  })

  runMigrations()
  initializeDatabase()
  migrateLegacyDefaultWorkspacePath()
  ensureAllWorkspaceCommands()
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
  registerRecurringRuleHandlers()
  registerRecurringCompletionHandlers()

  startMcpApiServer()

  createWindow()

  setupAutoUpdater()
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
  terminalService.destroyAllSessions()
  stopMcpApiServer()
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1000))
  // localStorage 등 Web Storage를 디스크에 flush한 뒤 종료
  session.defaultSession.flushStorageData()
  Promise.race([workspaceWatcher.stop(), timeout]).finally(() => app.quit())
})
