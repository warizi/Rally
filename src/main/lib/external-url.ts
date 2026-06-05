/**
 * 외부 URL 열기 allowlist.
 *
 * Electron에서 외부 URL을 OS handler로 넘기는 모든 경로(setWindowOpenHandler,
 * shell:openExternal IPC)가 동일한 기준을 쓰도록 한 곳에 모은다.
 * http: / https: 만 허용하고 file:, mailto:, javascript:, custom protocol,
 * 잘못된 URL은 모두 차단한다.
 */
export function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * BrowserWindow 내부 navigation 허용 여부 판정 (will-navigate 정책).
 *
 * 앱 자체 문서로의 navigation 만 허용한다.
 * - dev: `loadURL(ELECTRON_RENDERER_URL)` 과 동일 origin (http://localhost:port).
 * - packaged: `loadFile(...index.html)` 과 동일 file 경로.
 *
 * hash routing(`#/...`) 은 will-navigate 가 아닌 fragment 변경(did-navigate-in-page)
 * 이라 이 판정 대상이 아니다. 임의 http/https, file/data/javascript/custom protocol
 * navigation 은 모두 차단되며, 외부 링크는 setWindowOpenHandler / shell:openExternal
 * 경로에서만 OS browser 로 처리한다.
 *
 * @param appUrl 최초 로드한 앱 진입 URL (http(s) 또는 file)
 * @param targetUrl navigation 목적지 URL
 */
export function isAllowedAppNavigation(appUrl: string, targetUrl: string): boolean {
  let app: URL
  let target: URL
  try {
    app = new URL(appUrl)
    target = new URL(targetUrl)
  } catch {
    return false
  }

  if (app.protocol === 'http:' || app.protocol === 'https:') {
    // dev server: 동일 origin 의 전체 reload 만 허용.
    return target.origin === app.origin
  }

  if (app.protocol === 'file:') {
    // packaged: 동일 index.html 파일로의 navigation(=reload) 만 허용.
    return target.protocol === 'file:' && target.pathname === app.pathname
  }

  return false
}
