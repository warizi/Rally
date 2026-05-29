/**
 * shared/hooks/use-count-up.test.ts
 *
 * framer-motion animate 모킹 — onUpdate 콜백을 직접 호출해 setValue 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  capture: {
    from: 0,
    to: 0,
    duration: 0,
    onUpdate: null as null | ((v: number) => void)
  },
  stop: vi.fn()
}))

vi.mock('framer-motion', () => ({
  animate: (
    from: number,
    to: number,
    opts: { duration: number; ease: string; onUpdate: (v: number) => void }
  ) => {
    mocks.capture.from = from
    mocks.capture.to = to
    mocks.capture.duration = opts.duration
    mocks.capture.onUpdate = opts.onUpdate
    return { stop: mocks.stop }
  }
}))

import { useCountUp } from '../use-count-up'

beforeEach(() => {
  mocks.capture.from = 0
  mocks.capture.to = 0
  mocks.capture.onUpdate = null
  mocks.stop.mockClear()
})

describe('useCountUp', () => {
  it('초기 value=0', () => {
    const { result } = renderHook(() => useCountUp(100))
    expect(result.current).toBe(0)
  })

  it('mount → animate(0, target) 호출', () => {
    renderHook(() => useCountUp(100))
    expect(mocks.capture.from).toBe(0)
    expect(mocks.capture.to).toBe(100)
  })

  it('onUpdate 콜백 → setValue (Math.round 적용)', () => {
    const { result } = renderHook(() => useCountUp(100))
    act(() => mocks.capture.onUpdate?.(42.6))
    expect(result.current).toBe(43)
  })

  it('target 변경 → 새 animate(이전 target, 새 target) 호출', () => {
    const { rerender } = renderHook(({ t }) => useCountUp(t), { initialProps: { t: 100 } })
    expect(mocks.capture.from).toBe(0)
    expect(mocks.capture.to).toBe(100)
    rerender({ t: 200 })
    // prevRef 가 100 으로 갱신됐으므로 from=100
    expect(mocks.capture.from).toBe(100)
    expect(mocks.capture.to).toBe(200)
  })

  it('unmount → controls.stop() 호출', () => {
    const { unmount } = renderHook(() => useCountUp(100))
    unmount()
    expect(mocks.stop).toHaveBeenCalled()
  })

  it('duration 인자 forwarding', () => {
    renderHook(() => useCountUp(100, 2.5))
    expect(mocks.capture.duration).toBe(2.5)
  })

  it('duration 생략 시 기본 0.8', () => {
    renderHook(() => useCountUp(100))
    expect(mocks.capture.duration).toBe(0.8)
  })
})
