/**
 * useDebouncedValue 단위 테스트.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from '../use-debounced-value'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedValue', () => {
  it('초기값을 즉시 반환한다', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 250))
    expect(result.current).toBe('hello')
  })

  it('값 변경 후 delay 가 지나면 반영된다', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: 'a' }
    })
    expect(result.current).toBe('a')

    rerender({ v: 'b' })
    expect(result.current).toBe('a') // 아직 delay 경과 전

    act(() => vi.advanceTimersByTime(249))
    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('b')
  })

  it('빠른 연속 변경 시 마지막 값만 반영 (중간 값은 폐기)', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: 'a' }
    })

    rerender({ v: 'b' })
    act(() => vi.advanceTimersByTime(100))
    rerender({ v: 'c' })
    act(() => vi.advanceTimersByTime(100))
    rerender({ v: 'd' })
    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(250))
    expect(result.current).toBe('d')
  })

  it('동일한 값으로 rerender 시 추가 cleanup 없이 그대로 유지', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: 'a' }
    })
    rerender({ v: 'a' })
    act(() => vi.advanceTimersByTime(250))
    expect(result.current).toBe('a')
  })

  it('object reference 도 동일 비교 (단순 값 비교)', () => {
    const obj1 = { x: 1 }
    const obj2 = { x: 1 }
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: obj1 }
    })
    rerender({ v: obj2 })
    act(() => vi.advanceTimersByTime(250))
    expect(result.current).toBe(obj2)
  })
})
