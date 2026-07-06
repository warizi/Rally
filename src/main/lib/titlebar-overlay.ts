import { BrowserWindow } from 'electron'

/**
 * Windows 커스텀 타이틀바(Window Controls Overlay) 색상 정의.
 *
 * win32 는 titleBarStyle: 'hidden' + titleBarOverlay 로 네이티브 타이틀바를 없애고
 * 최소화/최대화/닫기 버튼만 우상단에 오버레이한다 (Win11 스냅 레이아웃 유지).
 * 오버레이 배경/심볼 색은 renderer 테마 토큰(global.css --background/--foreground)의
 * sRGB 근사치 — 테마 변경 시 settings:set('theme') 훅에서 applyTitleBarOverlayTheme 로 갱신.
 */
export type OverlayTheme = 'light' | 'dark'

/** TabBar(h-10 = 40px)와 캡션 버튼 높이 정렬 */
const OVERLAY_HEIGHT = 40

export const TITLEBAR_OVERLAY: Record<OverlayTheme, Electron.TitleBarOverlay> = {
  light: { color: '#ffffff', symbolColor: '#0a0a0a', height: OVERLAY_HEIGHT },
  dark: { color: '#0b0b0b', symbolColor: '#d9d9d9', height: OVERLAY_HEIGHT }
}

export function normalizeOverlayTheme(value: string | null): OverlayTheme {
  return value === 'dark' ? 'dark' : 'light'
}

/** 열린 모든 창의 오버레이 색을 테마에 맞춰 갱신 — win32 외 플랫폼은 no-op */
export function applyTitleBarOverlayTheme(value: string | null): void {
  if (process.platform !== 'win32') return
  const overlay = TITLEBAR_OVERLAY[normalizeOverlayTheme(value)]
  // 테스트 등 BrowserWindow 미가용 환경에서는 no-op
  for (const win of BrowserWindow?.getAllWindows?.() ?? []) {
    if (!win.isDestroyed()) win.setTitleBarOverlay(overlay)
  }
}
