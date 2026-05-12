/**
 * useFolderSearch 단위 테스트 (Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFolderSearch } from '../use-folder-search'
import type { WorkspaceTreeNode } from '../types'

function folder(id: string, name: string, children: WorkspaceTreeNode[] = []): WorkspaceTreeNode {
  return { kind: 'folder', id, name, color: null, children } as unknown as WorkspaceTreeNode
}
function note(id: string, name: string): WorkspaceTreeNode {
  return { kind: 'note', id, name, folderId: null } as unknown as WorkspaceTreeNode
}

const tree: WorkspaceTreeNode[] = [
  folder('f-1', 'docs', [note('n-1', 'apple'), note('n-2', 'banana')]),
  folder('f-2', 'archive', [note('n-3', 'apricot')])
]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useFolderSearch', () => {
  it('초기 상태: 빈 쿼리 + 매치 없음 + activeIndex -1', () => {
    const { result } = renderHook(() => useFolderSearch(tree))
    expect(result.current.query).toBe('')
    expect(result.current.result.matchedIds.size).toBe(0)
    expect(result.current.activeIndex).toBe(-1)
    expect(result.current.activeId).toBeNull()
  })

  it('setQuery 즉시 query 변경, debouncedQuery 는 delay 후 반영', () => {
    const { result } = renderHook(() => useFolderSearch(tree))
    act(() => result.current.setQuery('app'))
    expect(result.current.query).toBe('app')
    expect(result.current.debouncedQuery).toBe('')

    act(() => vi.advanceTimersByTime(250))
    expect(result.current.debouncedQuery).toBe('app')
  })

  it('디바운스 후 매치 결과 + activeIndex=0 + activeId=첫매치', () => {
    const { result } = renderHook(() => useFolderSearch(tree))
    act(() => {
      result.current.setQuery('ap')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    // 매치: apple, apricot (DFS 순서)
    expect(result.current.result.orderedMatches).toEqual(['n-1', 'n-3'])
    expect(result.current.activeIndex).toBe(0)
    expect(result.current.activeId).toBe('n-1')
  })

  it('goNext / goPrev wrap-around', () => {
    const { result } = renderHook(() => useFolderSearch(tree))
    act(() => {
      result.current.setQuery('ap')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.activeId).toBe('n-1')

    act(() => result.current.goNext())
    expect(result.current.activeId).toBe('n-3')

    act(() => result.current.goNext())
    expect(result.current.activeId).toBe('n-1') // wrap

    act(() => result.current.goPrev())
    expect(result.current.activeId).toBe('n-3') // wrap reverse
  })

  it('clear 시 query 비우고 activeIndex -1', () => {
    const { result } = renderHook(() => useFolderSearch(tree))
    act(() => {
      result.current.setQuery('ap')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.activeId).toBe('n-1')

    act(() => result.current.clear())
    expect(result.current.query).toBe('')
    expect(result.current.activeIndex).toBe(-1)
    expect(result.current.activeId).toBeNull()

    // clear 후 debounce 사이클 한 번 더 흘러도 매치 없음 유지
    act(() => vi.advanceTimersByTime(250))
    expect(result.current.result.matchedIds.size).toBe(0)
  })

  it('매치 없는 쿼리 → activeIndex -1, activeId null', () => {
    const { result } = renderHook(() => useFolderSearch(tree))
    act(() => {
      result.current.setQuery('xyz')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.result.orderedMatches).toEqual([])
    expect(result.current.activeIndex).toBe(-1)
    expect(result.current.activeId).toBeNull()
  })

  it('ancestorIds 가 자동 펼침용 후보로 반환됨', () => {
    const { result } = renderHook(() => useFolderSearch(tree))
    act(() => {
      result.current.setQuery('apple')
    })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current.result.ancestorIds).toEqual(new Set(['f-1']))
  })
})
