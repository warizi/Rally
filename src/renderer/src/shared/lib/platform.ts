/**
 * renderer 전역 platform 판별 유틸.
 *
 * preload가 이미 노출한 `window.electron.process.platform`(@electron-toolkit/preload)을
 * 읽는 래퍼 — 새 IPC/expose 없이 renderer 어느 레이어에서든 OS 분기 가능.
 * 테스트(happy-dom)에는 `window.electron`이 없으므로 'darwin' fallback
 * (현행 mac 기준 동작 보존).
 */
export type AppPlatform = 'darwin' | 'win32' | 'linux'

let cachedPlatform: AppPlatform | null = null

function normalizePlatform(platform: string | undefined): AppPlatform {
  if (platform === 'win32' || platform === 'linux') return platform
  return 'darwin'
}

export function getPlatform(): AppPlatform {
  if (cachedPlatform) return cachedPlatform
  cachedPlatform = normalizePlatform(window.electron?.process?.platform)
  return cachedPlatform
}

export function isMac(): boolean {
  return getPlatform() === 'darwin'
}

export function isWindows(): boolean {
  return getPlatform() === 'win32'
}

export function isLinux(): boolean {
  return getPlatform() === 'linux'
}

export function __resetPlatformCacheForTest(): void {
  cachedPlatform = null
}
