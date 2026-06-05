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
