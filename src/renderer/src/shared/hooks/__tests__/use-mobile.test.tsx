/**
 * shared/hooks/use-mobile.test.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '../use-mobile'

type MQLListener = () => void
const listeners: MQLListener[] = []

beforeEach(() => {
  listeners.length = 0
  ;(window as unknown as { innerWidth: number }).innerWidth = 1024
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (_: string) =>
      ({
        matches: false,
        addEventListener: (_evt: string, cb: MQLListener) => listeners.push(cb),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }) as unknown as MediaQueryList
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useIsMobile', () => {
  it('innerWidth >= 768 → false', () => {
    ;(window as unknown as { innerWidth: number }).innerWidth = 1024
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('innerWidth < 768 → true', () => {
    ;(window as unknown as { innerWidth: number }).innerWidth = 500
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('matchMedia change 이벤트 → 상태 업데이트', () => {
    ;(window as unknown as { innerWidth: number }).innerWidth = 1024
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
    act(() => {
      ;(window as unknown as { innerWidth: number }).innerWidth = 500
      listeners.forEach((cb) => cb())
    })
    expect(result.current).toBe(true)
  })
})
