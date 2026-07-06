/**
 * titlebar-overlay 단위 테스트.
 *
 * win32 WCO 캡션 버튼 색상 — 테마 매핑 + 열린 창 일괄 갱신 + 비 win32 no-op.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  windows: [] as Array<{ isDestroyed: () => boolean; setTitleBarOverlay: ReturnType<typeof vi.fn> }>
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => mocks.windows
  }
}))

import {
  TITLEBAR_OVERLAY,
  normalizeOverlayTheme,
  applyTitleBarOverlayTheme
} from '../titlebar-overlay'

const originalPlatform = process.platform

function setPlatform(value: string): void {
  Object.defineProperty(process, 'platform', { value })
}

function fakeWindow(destroyed = false): (typeof mocks.windows)[number] {
  return { isDestroyed: () => destroyed, setTitleBarOverlay: vi.fn() }
}

beforeEach(() => {
  mocks.windows = []
})

afterEach(() => {
  setPlatform(originalPlatform)
})

describe('normalizeOverlayTheme', () => {
  it("'dark' → dark, 그 외(null/미지값) → light 폴백", () => {
    expect(normalizeOverlayTheme('dark')).toBe('dark')
    expect(normalizeOverlayTheme('light')).toBe('light')
    expect(normalizeOverlayTheme(null)).toBe('light')
    expect(normalizeOverlayTheme('unknown')).toBe('light')
  })
})

describe('applyTitleBarOverlayTheme', () => {
  it('win32 → 열린 모든 창에 테마 색상 적용', () => {
    setPlatform('win32')
    const w1 = fakeWindow()
    const w2 = fakeWindow()
    mocks.windows = [w1, w2]
    applyTitleBarOverlayTheme('dark')
    expect(w1.setTitleBarOverlay).toHaveBeenCalledWith(TITLEBAR_OVERLAY.dark)
    expect(w2.setTitleBarOverlay).toHaveBeenCalledWith(TITLEBAR_OVERLAY.dark)
  })

  it('destroyed 창은 스킵', () => {
    setPlatform('win32')
    const dead = fakeWindow(true)
    mocks.windows = [dead]
    applyTitleBarOverlayTheme('light')
    expect(dead.setTitleBarOverlay).not.toHaveBeenCalled()
  })

  it('비 win32 플랫폼 → no-op', () => {
    setPlatform('darwin')
    const w = fakeWindow()
    mocks.windows = [w]
    applyTitleBarOverlayTheme('dark')
    expect(w.setTitleBarOverlay).not.toHaveBeenCalled()
  })
})
