/**
 * useCsvSearch 회귀 테스트.
 *
 * - debounce 후 헤더+데이터 매칭, 대소문자 무시
 * - matches 위치 (row=-1 헤더, row>=0 데이터)
 * - next/prev 순환 인덱스
 * - matchedCells Set 형식 ('row_col')
 * - setQuery → currentIndex 0 으로 리셋
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCsvSearch } from '../use-csv-search'

const HEADERS = ['Name', 'Email', 'Phone']
const DATA = [
  ['Alice', 'alice@x.com', '111'],
  ['Bob', 'BOB@x.com', '222'],
  ['Cara', 'cara@y.com', '333']
]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function advanceDebounce(): void {
  act(() => {
    vi.advanceTimersByTime(200)
  })
}

describe('useCsvSearch', () => {
  it('empty query → matches=[], currentMatch=null, matchedCells empty', () => {
    const { result } = renderHook(() => useCsvSearch(DATA, HEADERS))
    expect(result.current.matches).toEqual([])
    expect(result.current.currentMatch).toBeNull()
    expect(result.current.matchedCells.size).toBe(0)
  })

  it('데이터 매칭 (대소문자 무시)', () => {
    const { result } = renderHook(() => useCsvSearch(DATA, HEADERS))
    act(() => result.current.setQuery('alice'))
    advanceDebounce()
    expect(result.current.matches).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 }
    ])
  })

  it('헤더 매칭 → row=-1', () => {
    const { result } = renderHook(() => useCsvSearch(DATA, HEADERS))
    act(() => result.current.setQuery('email'))
    advanceDebounce()
    expect(result.current.matches.some((m) => m.row === -1 && m.col === 1)).toBe(true)
  })

  it('matchedCells Set 키 형식 (row_col)', () => {
    const { result } = renderHook(() => useCsvSearch(DATA, HEADERS))
    act(() => result.current.setQuery('alice'))
    advanceDebounce()
    expect(result.current.matchedCells.has('0_0')).toBe(true)
    expect(result.current.matchedCells.has('0_1')).toBe(true)
  })

  it('next/prev → 인덱스 순환', () => {
    const { result } = renderHook(() => useCsvSearch(DATA, HEADERS))
    act(() => result.current.setQuery('1')) // matches: '111' at (0,2)
    advanceDebounce()
    expect(result.current.currentIndex).toBe(0)
    act(() => result.current.next())
    expect(result.current.currentIndex).toBe(0) // 1개라 순환 후 0
    act(() => result.current.prev())
    expect(result.current.currentIndex).toBe(0)
  })

  it('next → 다음 match 로 wrap-around', () => {
    const { result } = renderHook(() => useCsvSearch(DATA, HEADERS))
    act(() => result.current.setQuery('com')) // 헤더 0건 + 데이터 3건
    advanceDebounce()
    const total = result.current.matches.length
    expect(total).toBeGreaterThan(1)

    act(() => result.current.next())
    expect(result.current.currentIndex).toBe(1)
    // 마지막 매치까지 next 하면 0으로 wrap
    for (let i = 1; i < total; i++) act(() => result.current.next())
    expect(result.current.currentIndex).toBe(0)
  })

  it('setQuery → currentIndex 0 으로 리셋', () => {
    const { result } = renderHook(() => useCsvSearch(DATA, HEADERS))
    act(() => result.current.setQuery('com'))
    advanceDebounce()
    act(() => result.current.next())
    expect(result.current.currentIndex).toBeGreaterThan(0)

    act(() => result.current.setQuery('alice'))
    expect(result.current.currentIndex).toBe(0)
  })

  it('debounce 200ms 이전에는 matches 미갱신', () => {
    const { result } = renderHook(() => useCsvSearch(DATA, HEADERS))
    act(() => result.current.setQuery('alice'))
    // 100ms 만 진행
    act(() => vi.advanceTimersByTime(100))
    expect(result.current.matches).toEqual([])
    // 100ms 더 진행 = 총 200ms
    act(() => vi.advanceTimersByTime(100))
    expect(result.current.matches.length).toBeGreaterThan(0)
  })
})
