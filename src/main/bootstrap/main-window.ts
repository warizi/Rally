import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'
import { scoped } from '../lib/logger'
import { isAllowedExternalUrl, isAllowedAppNavigation } from '../lib/external-url'

/**
 * 메인 BrowserWindow 생성 + 보안/navigation 정책.
 *
 * webPreferences 보안 default(sandbox/contextIsolation/nodeIntegration/webSecurity)와
 * setWindowOpenHandler·will-navigate 정책은 `__tests__/window-security.test.ts` 가
 * 이 파일 소스를 스캔해 회귀 차단한다.
 */
export function createWindow(): void {
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
