/**
 * features/csv/edit-csv/model/use-csv-search.test.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCsvSearch } from '../use-csv-search'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const headers = ['Name', 'Age', 'City']
const data = [
  ['Alice', '30', 'Seoul'],
  ['Bob', '25', 'NYC'],
  ['Carol', '35', 'Tokyo']
]

describe('useCsvSearch', () => {
  it('초기 상태: query 빈문자, matches 없음', () => {
    const { result } = renderHook(() => useCsvSearch(data, headers))
    expect(result.current.query).toBe('')
    expect(result.current.matches).toEqual([])
  })

  it('setQuery + debounce → 매칭 데이터 셀 반환', () => {
    const { result } = renderHook(() => useCsvSearch(data, headers))
    act(() => {
      result.current.setQuery('Seoul')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.matches.length).toBeGreaterThan(0)
    expect(result.current.matches[0]).toEqual({ row: 0, col: 2 })
  })

  it('헤더 매칭 → row=-1', () => {
    const { result } = renderHook(() => useCsvSearch(data, headers))
    act(() => {
      result.current.setQuery('Age')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.matches.find((m) => m.row === -1)).toBeTruthy()
  })

  it('case-insensitive 매칭', () => {
    const { result } = renderHook(() => useCsvSearch(data, headers))
    act(() => {
      result.current.setQuery('alice')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.matches.length).toBeGreaterThan(0)
  })

  it('next/prev → currentIndex 순환', () => {
    const { result } = renderHook(() => useCsvSearch(data, headers))
    act(() => {
      result.current.setQuery('o') // 여러 매칭 (Seoul, Tokyo, Carol, Bob)
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    const len = result.current.matches.length
    expect(len).toBeGreaterThan(1)
    act(() => {
      result.current.next()
    })
    expect(result.current.currentIndex).toBe(1)
  })

  it('빈 데이터 + query → matches 빈배열', () => {
    const { result } = renderHook(() => useCsvSearch([], []))
    act(() => {
      result.current.setQuery('anything')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.matches).toEqual([])
  })
})
