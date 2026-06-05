import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  screen,
  session,
  Menu,
  type MenuItemConstructorOptions
} from 'electron'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import icon from '../../resources/icon.png?asset'
import { scoped } from './lib/logger'
import { isAllowedExternalUrl, isAllowedAppNavigation } from './lib/external-url'
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
import { registerCanvasGroupHandlers } from './ipc/canvas-group'
import { registerNoteImageHandlers } from './ipc/note-image'
import { registerReminderHandlers } from './ipc/reminder'
import { registerTagHandlers } from './ipc/tag'
import { registerItemTagHandlers } from './ipc/item-tag'
import { registerTerminalHandlers } from './ipc/terminal'
import { reminderScheduler } from './services/reminder-scheduler'
import { trashSweeper } from './services/trash/trash-sweeper'
import { workspaceWatcher } from './services/workspace-watcher'
import { workspaceService } from './services/workspace'
import { terminalService } from './services/terminal'
import { startMcpApiServer, stopMcpApiServer } from './mcp-api/server'
import { registerAppInfoHandlers } from './ipc/app-info'
import { registerBackupHandlers } from './ipc/backup'
import { registerRecurringRuleHandlers } from './ipc/recurring-rule'
import { registerRecurringCompletionHandlers } from './ipc/recurring-completion'
import { registerTemplateHandlers } from './ipc/template'
import { registerNoteStyleTemplateHandlers } from './ipc/note-style-template'
import { registerHistoryHandlers } from './ipc/history'
import { registerTrashHandlers } from './ipc/trash'
import { registerOnboardingHandlers } from './ipc/onboarding'
import { registerSkillHandlers } from './ipc/skill'
import { seedSystemSkills } from './services/skill'
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
  const log = scoped('migrate-default-path')
  const legacyPath = join(app.getPath('documents'), 'Rally', '기본 워크스페이스')
  const newPath = join(app.getPath('home'), 'Rally', '기본 워크스페이스')
  if (legacyPath === newPath) return

  const all = workspaceService.getAll()
  const target = all.find((ws) => ws.path === legacyPath)
  if (!target) return

  if (all.some((ws) => ws.id !== target.id && ws.path === newPath)) {
    log.warn(`another workspace already uses ${newPath}; skipping migration`)
    return
  }

  try {
    mkdirSync(dirname(newPath), { recursive: true })
  } catch (err) {
    log.warn(`cannot create parent dir for ${newPath}:`, err)
    return
  }

  if (!existsSync(newPath)) {
    let moved = false
    try {
      renameSync(legacyPath, newPath)
      moved = true
      log.info(`moved ${legacyPath} → ${newPath}`)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      log.warn(
        `cannot move legacy dir (${code}); creating fresh dir. ` +
          `Existing data (if any) remains at ${legacyPath}.`
      )
    }

    if (!moved) {
      try {
        mkdirSync(newPath, { recursive: true })
      } catch (err) {
        log.warn(`cannot create ${newPath}:`, err)
        return
      }
    }
  }

  try {
    workspaceService.update(target.id, { path: newPath })
    log.info(`updated workspace ${target.id} path: ${legacyPath} → ${newPath}`)
  } catch (err) {
    log.warn(`failed to update workspace path in DB:`, err)
  }
}

function setupAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  })

  const viewSubmenu: MenuItemConstructorOptions[] = []
  if (is.dev) {
    viewSubmenu.push(
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' }
    )
  }
  viewSubmenu.push({ role: 'togglefullscreen' })
  template.push({ label: 'View', submenu: viewSubmenu })

  const windowSubmenu: MenuItemConstructorOptions[] = [{ role: 'minimize' }, { role: 'zoom' }]
  if (isMac) {
    windowSubmenu.push({ type: 'separator' }, { role: 'front' })
  }
  template.push({ role: 'windowMenu', label: 'Window', submenu: windowSubmenu })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const navLog = scoped('navigation')
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
      // 보안-1: 렌더러 프로세스를 OS 샌드박스 안에서 실행 (Chromium 표준 모델).
      // RCE 발생 시 임의 코드가 파일시스템 / 네이티브 모듈에 접근 못 하도록 차단.
      // preload 는 fs/path/child_process 등 native Node 모듈을 일절 사용하지 않음
      // (api-surface.test.ts 가 회귀 차단).
      sandbox: true,
      // 명시적 보안 default 선언 (Electron 기본값이지만, 회귀 가시성을 위해 박아 둠).
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools({ mode: 'right' })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // 보안: 앱 자체 문서 외의 navigation 을 전역 차단 (electronegativity LIMIT_NAVIGATION).
  // 앱 진입 URL — dev 는 렌더러 dev server, packaged 는 file:// index.html.
  const appUrl =
    is.dev && process.env['ELECTRON_RENDERER_URL']
      ? process.env['ELECTRON_RENDERER_URL']
      : pathToFileURL(join(__dirname, '../renderer/index.html')).toString()

  // 허용되지 않은 navigation(임의 http/https, file/data/javascript/custom protocol)은
  // 차단한다. 외부 링크는 setWindowOpenHandler / shell:openExternal 경로에서만 처리한다.
  // hash routing 은 will-navigate 가 아니라 did-navigate-in-page 라 영향받지 않는다.
  const blockUnlessAppNavigation = (event: Electron.Event, url: string): void => {
    if (!isAllowedAppNavigation(appUrl, url)) {
      event.preventDefault()
      navLog.warn('blocked navigation', { url })
    }
  }
  mainWindow.webContents.on('will-navigate', blockUnlessAppNavigation)
  // will-redirect: 서버/메타 리다이렉트를 통한 우회도 동일 정책으로 차단.
  mainWindow.webContents.on('will-redirect', blockUnlessAppNavigation)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setName('Rally')
  electronApp.setAppUserModelId('com.jin.rally')
  setupAppMenu()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    if (isAllowedExternalUrl(url)) {
      await shell.openExternal(url)
    }
  })

  runMigrations()
  initializeDatabase()
  seedSystemSkills()
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
  registerCanvasGroupHandlers()
  registerNoteImageHandlers()
  registerReminderHandlers()
  registerTagHandlers()
  registerItemTagHandlers()
  registerTerminalHandlers()
  registerAppInfoHandlers()
  registerBackupHandlers()
  registerRecurringRuleHandlers()
  registerRecurringCompletionHandlers()
  registerTemplateHandlers()
  registerNoteStyleTemplateHandlers()
  registerHistoryHandlers()
  registerTrashHandlers()
  registerOnboardingHandlers()
  registerSkillHandlers()

  startMcpApiServer()

  createWindow()

  setupAutoUpdater()
  reminderScheduler.start()
  trashSweeper.start()

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
  trashSweeper.stop()
  terminalService.destroyAllSessions()
  stopMcpApiServer()
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1000))
  // localStorage 등 Web Storage를 디스크에 flush한 뒤 종료
  session.defaultSession.flushStorageData()
  Promise.race([workspaceWatcher.stop(), timeout]).finally(() => app.quit())
})
