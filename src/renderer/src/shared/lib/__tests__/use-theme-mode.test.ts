/**
 * shared/lib/use-theme-mode.test.ts
 *
 * html.dark 클래스 토글에 따라 'light' / 'dark' 반환. MutationObserver 로 즉시 갱신.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useThemeMode } from '../use-theme-mode'

beforeEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('useThemeMode', () => {
  it('html.dark 없으면 → light', () => {
    const { result } = renderHook(() => useThemeMode())
    expect(result.current).toBe('light')
  })

  it('초기에 html.dark 있으면 → dark', () => {
    document.documentElement.classList.add('dark')
    const { result } = renderHook(() => useThemeMode())
    expect(result.current).toBe('dark')
  })

  it('mount 후 dark 추가 → 자동으로 dark 로 갱신 (MutationObserver)', async () => {
    const { result } = renderHook(() => useThemeMode())
    expect(result.current).toBe('light')
    act(() => {
      document.documentElement.classList.add('dark')
    })
    await waitFor(() => expect(result.current).toBe('dark'))
  })

  it('dark 제거 → light 로 갱신', async () => {
    document.documentElement.classList.add('dark')
    const { result } = renderHook(() => useThemeMode())
    expect(result.current).toBe('dark')
    act(() => {
      document.documentElement.classList.remove('dark')
    })
    await waitFor(() => expect(result.current).toBe('light'))
  })

  it('unmount → observer disconnect (이후 변경 영향 없음)', () => {
    const { result, unmount } = renderHook(() => useThemeMode())
    const before = result.current
    unmount()
    act(() => {
      document.documentElement.classList.toggle('dark')
    })
    // hook 의 state 는 unmount 후 stale — 변하지 않음
    expect(result.current).toBe(before)
  })
})
