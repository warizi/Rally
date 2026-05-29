/**
 * useAutoExpandOnHover 회귀 테스트.
 *
 * - isHovered=false → 타이머 X
 * - isHovered=true + 이미 open → 타이머 X
 * - isHovered=true + closed → 700ms 후 node.open() 호출
 * - hover off 또는 unmount 시 타이머 cleanup
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoExpandOnHover } from '../use-auto-expand-on-hover'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

interface FakeNode {
  id: string
  isOpen: boolean
  open: ReturnType<typeof vi.fn>
}

function makeNode(overrides?: Partial<FakeNode>): FakeNode {
  return { id: 'n-1', isOpen: false, open: vi.fn(), ...overrides }
}

describe('useAutoExpandOnHover', () => {
  it('isHovered=false → open() 호출 안 됨', () => {
    const node = makeNode()
    renderHook(({ h }) => useAutoExpandOnHover(node as never, h), {
      initialProps: { h: false }
    })
    vi.advanceTimersByTime(1000)
    expect(node.open).not.toHaveBeenCalled()
  })

  it('이미 isOpen=true → 700ms 지나도 open() 안 호출', () => {
    const node = makeNode({ isOpen: true })
    renderHook(({ h }) => useAutoExpandOnHover(node as never, h), {
      initialProps: { h: true }
    })
    vi.advanceTimersByTime(800)
    expect(node.open).not.toHaveBeenCalled()
  })

  it('isHovered=true + closed → 700ms 후 open() 호출', () => {
    const node = makeNode()
    renderHook(({ h }) => useAutoExpandOnHover(node as never, h), {
      initialProps: { h: true }
    })
    vi.advanceTimersByTime(699)
    expect(node.open).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(node.open).toHaveBeenCalledTimes(1)
  })

  it('hover off (timer 진행 중 isHovered=false) → cleanup, open() 안 호출', () => {
    const node = makeNode()
    const { rerender } = renderHook(({ h }) => useAutoExpandOnHover(node as never, h), {
      initialProps: { h: true }
    })
    vi.advanceTimersByTime(400)
    rerender({ h: false })
    vi.advanceTimersByTime(400)
    expect(node.open).not.toHaveBeenCalled()
  })

  it('unmount → 타이머 cleanup', () => {
    const node = makeNode()
    const { unmount } = renderHook(({ h }) => useAutoExpandOnHover(node as never, h), {
      initialProps: { h: true }
    })
    vi.advanceTimersByTime(300)
    unmount()
    vi.advanceTimersByTime(500)
    expect(node.open).not.toHaveBeenCalled()
  })
})
