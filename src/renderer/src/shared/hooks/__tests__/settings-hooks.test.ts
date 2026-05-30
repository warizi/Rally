/**
 * shared/hooks settings-hooks.test.ts
 *
 * useShowAuthorBadgeSetting / useTabHeaderCollapsedSetting / useIsMobile.
 * window.api.settings mock + matchMedia mock.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import React from 'react'

import { useShowAuthorBadgeSetting } from '../use-show-author-badge-setting'
import { useTabHeaderCollapsedSetting } from '../use-tab-header-collapsed-setting'
import { useIsMobile } from '../use-mobile'

type SettingsMock = {
  get: (key: string) => Promise<{ success: boolean; data?: string | null }>
  set: (key: string, value: string) => Promise<{ success: boolean }>
}

function setupApi(get: SettingsMock['get'], set?: SettingsMock['set']): void {
  ;(window as unknown as Record<string, unknown>).api = {
    settings: {
      get,
      set: set ?? vi.fn(async () => ({ success: true }))
    }
  }
}

function wrapper(): { wrapper: ({ children }: { children: ReactNode }) => React.JSX.Element } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    wrapper: ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('useShowAuthorBadgeSetting', () => {
  it('저장값 없음 → default true', async () => {
    setupApi(async () => ({ success: true, data: null }))
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), wrapper())
    await waitFor(() => expect(result.current.show).toBe(true))
  })

  it('"false" 저장 → false 반환', async () => {
    setupApi(async () => ({ success: true, data: 'false' }))
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), wrapper())
    await waitFor(() => expect(result.current.show).toBe(false))
  })

  it('"true" 저장 → true 반환', async () => {
    setupApi(async () => ({ success: true, data: 'true' }))
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), wrapper())
    await waitFor(() => expect(result.current.show).toBe(true))
  })

  it('success=false → default true', async () => {
    setupApi(async () => ({ success: false }))
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), wrapper())
    await waitFor(() => expect(result.current.show).toBe(true))
  })

  it('setShow 호출 → settings.set 호출', async () => {
    const setMock = vi.fn(async () => ({ success: true }))
    setupApi(async () => ({ success: true, data: 'true' }), setMock)
    const { result } = renderHook(() => useShowAuthorBadgeSetting(), wrapper())
    await waitFor(() => expect(result.current.show).toBe(true))
    await act(async () => {
      await result.current.setShow(false)
    })
    expect(setMock).toHaveBeenCalledWith('authorBadge.show', 'false')
  })
})

describe('useTabHeaderCollapsedSetting', () => {
  it('"true" 저장 → collapsed true', async () => {
    setupApi(async () => ({ success: true, data: 'true' }))
    const { result } = renderHook(() => useTabHeaderCollapsedSetting(), wrapper())
    await waitFor(() => expect(result.current.collapsed).toBe(true))
  })

  it('"false" 저장 → collapsed false', async () => {
    setupApi(async () => ({ success: true, data: 'false' }))
    const { result } = renderHook(() => useTabHeaderCollapsedSetting(), wrapper())
    await waitFor(() => expect(result.current.collapsed).toBe(false))
  })

  it('success=false → false (default)', async () => {
    setupApi(async () => ({ success: false }))
    const { result } = renderHook(() => useTabHeaderCollapsedSetting(), wrapper())
    await waitFor(() => expect(result.current.collapsed).toBe(false))
  })

  it('setCollapsed → settings.set 호출', async () => {
    const setMock = vi.fn(async () => ({ success: true }))
    setupApi(async () => ({ success: true, data: 'false' }), setMock)
    const { result } = renderHook(() => useTabHeaderCollapsedSetting(), wrapper())
    await waitFor(() => expect(result.current.collapsed).toBe(false))
    await act(async () => {
      await result.current.setCollapsed(true)
    })
    expect(setMock).toHaveBeenCalledWith('tabHeader.defaultCollapsed', 'true')
  })
})

describe('useIsMobile', () => {
  let listeners: Array<() => void> = []
  const originalMatchMedia = window.matchMedia
  const originalInnerWidth = window.innerWidth

  beforeEach(() => {
    listeners = []
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (_q: string) => ({
        matches: false,
        media: _q,
        onchange: null,
        addEventListener: (_e: string, cb: () => void) => listeners.push(cb),
        removeEventListener: (_e: string, cb: () => void) => {
          listeners = listeners.filter((x) => x !== cb)
        },
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: () => false
      })
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    })
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth
    })
  })

  it('innerWidth >= 768 → false', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024
    })
    const { result } = renderHook(() => useIsMobile())
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('innerWidth < 768 → true', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500
    })
    const { result } = renderHook(() => useIsMobile())
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('resize 이벤트 → 값 업데이트', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024
    })
    const { result } = renderHook(() => useIsMobile())
    await waitFor(() => expect(result.current).toBe(false))
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 400
    })
    act(() => listeners.forEach((cb) => cb()))
    await waitFor(() => expect(result.current).toBe(true))
  })
})
