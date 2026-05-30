import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTreeOpenState } from '../use-tree-open-state'
import { useTabStore } from '@/entities/tab-system'

beforeEach(() => {
  useTabStore.getState().reset()
})

// ─── 초기 상태 ────────────────────────────────────────────────
describe('초기 상태', () => {
  it('tabId가 undefined이면 openState = {} 를 반환한다', () => {
    const { result } = renderHook(() => useTreeOpenState(undefined))
    expect(result.current.openState).toEqual({})
  })

  it('searchParams에 folderOpenState가 없으면 {} 를 반환한다', () => {
    const tabId = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder/ws-1', title: '탐색기' })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    expect(result.current.openState).toEqual({})
  })

  it('searchParams에 folderOpenState가 있으면 파싱하여 반환한다', () => {
    const tabId = useTabStore.getState().openTab({
      type: 'folder',
      pathname: '/folder/ws-1',
      title: '탐색기',
      searchParams: { folderOpenState: JSON.stringify({ f1: true, f2: false }) }
    })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    expect(result.current.openState).toEqual({ f1: true, f2: false })
  })

  it('folderOpenState가 malformed JSON이면 {} 를 반환한다', () => {
    const tabId = useTabStore.getState().openTab({
      type: 'folder',
      pathname: '/folder/ws-1',
      title: '탐색기',
      searchParams: { folderOpenState: 'not-valid-json' }
    })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    expect(result.current.openState).toEqual({})
  })
})

// ─── toggle ───────────────────────────────────────────────────
describe('toggle', () => {
  it('toggle(id, true) 후 openState[id] === true 가 된다', () => {
    const tabId = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder/ws-1', title: '탐색기' })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    act(() => {
      result.current.toggle('f1', true)
    })
    expect(result.current.openState['f1']).toBe(true)
  })

  it('toggle(id, false) 후 openState[id] === false 가 된다', () => {
    const tabId = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder/ws-1', title: '탐색기' })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    act(() => {
      result.current.toggle('f1', false)
    })
    expect(result.current.openState['f1']).toBe(false)
  })

  it('toggle 후 tab의 searchParams에 저장된다', () => {
    const tabId = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder/ws-1', title: '탐색기' })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    act(() => {
      result.current.toggle('f1', true)
    })
    const tab = useTabStore.getState().tabs[tabId]
    expect(JSON.parse(tab.searchParams?.folderOpenState ?? '{}')).toEqual({ f1: true })
  })

  it('tabId가 없으면 toggle해도 에러 없이 처리된다', () => {
    const { result } = renderHook(() => useTreeOpenState(undefined))
    expect(() => {
      act(() => {
        result.current.toggle('f1', true)
      })
    }).not.toThrow()
  })
})

// ─── collapseAll ──────────────────────────────────────────────
describe('collapseAll', () => {
  it('collapseAll 후 folderOpenState가 searchParams에서 제거된다', () => {
    const tabId = useTabStore.getState().openTab({
      type: 'folder',
      pathname: '/folder/ws-1',
      title: '탐색기',
      searchParams: { folderOpenState: JSON.stringify({ f1: true }) }
    })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    act(() => {
      result.current.collapseAll()
    })
    const tab = useTabStore.getState().tabs[tabId]
    expect(tab.searchParams?.folderOpenState).toBeUndefined()
  })
})

// ─── 탭 간 독립성 ─────────────────────────────────────────────
describe('탭 간 독립성', () => {
  it('두 탭은 독립적인 openState를 가진다', () => {
    const tabId1 = useTabStore.getState().openTab({
      type: 'folder',
      pathname: '/folder/ws-1',
      title: '탐색기 1',
      searchParams: { folderOpenState: JSON.stringify({ f1: true }) }
    })
    const tabId2 = useTabStore.getState().openTab({
      type: 'folder',
      pathname: '/folder/ws-2',
      title: '탐색기 2',
      searchParams: { folderOpenState: JSON.stringify({ f2: false }) }
    })
    const { result: r1 } = renderHook(() => useTreeOpenState(tabId1))
    const { result: r2 } = renderHook(() => useTreeOpenState(tabId2))

    expect(r1.current.openState).toEqual({ f1: true })
    expect(r2.current.openState).toEqual({ f2: false })
  })
})

describe('expandIds', () => {
  it('빈 iterable → 변화 없음', () => {
    const tabId = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder/ws-1', title: '탐색기' })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    act(() => result.current.expandIds([], null))
    expect(result.current.openState).toEqual({})
  })

  it('단일 id 펼침', () => {
    const tabId = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder/ws-1', title: '탐색기' })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    act(() => result.current.expandIds(['f1'], null))
    expect(result.current.openState).toEqual({ f1: true })
  })

  it('여러 id 일괄 펼침 (Set 도 지원)', () => {
    const tabId = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder/ws-1', title: '탐색기' })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    act(() => result.current.expandIds(new Set(['f1', 'f2', 'f3']), null))
    expect(result.current.openState).toEqual({ f1: true, f2: true, f3: true })
  })

  it('이미 모두 열려있으면 navigateTab 호출 안 함 (skip)', () => {
    const tabId = useTabStore.getState().openTab({
      type: 'folder',
      pathname: '/folder/ws-1',
      title: '탐색기',
      searchParams: { folderOpenState: JSON.stringify({ f1: true, f2: true }) }
    })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    const before = useTabStore.getState().tabs[tabId]?.searchParams
    act(() => result.current.expandIds(['f1', 'f2'], null))
    const after = useTabStore.getState().tabs[tabId]?.searchParams
    expect(after).toBe(before) // reference 동일 (skip)
  })

  it('기존 openState 와 병합 (다른 키 보존)', () => {
    const tabId = useTabStore.getState().openTab({
      type: 'folder',
      pathname: '/folder/ws-1',
      title: '탐색기',
      searchParams: { folderOpenState: JSON.stringify({ existing: true }) }
    })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    act(() => result.current.expandIds(['new-1', 'new-2'], null))
    expect(result.current.openState).toEqual({
      existing: true,
      'new-1': true,
      'new-2': true
    })
  })

  it('tabId 없으면 expandIds 무동작 (에러 없음)', () => {
    const { result } = renderHook(() => useTreeOpenState(undefined))
    act(() => result.current.expandIds(['f1', 'f2'], null))
    expect(result.current.openState).toEqual({})
  })

  it('expandIds 호출 시 treeApi.open 도 각 id 마다 호출됨', () => {
    const tabId = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder/ws-1', title: '탐색기' })
    const { result } = renderHook(() => useTreeOpenState(tabId))
    const treeApi = {
      closeAll: vi.fn(),
      isOpen: vi.fn(() => false),
      scrollTo: vi.fn(),
      open: vi.fn(),
      close: vi.fn(),
      get: vi.fn(() => null)
    }
    act(() => result.current.expandIds(['a', 'b', 'c'], treeApi))
    expect(treeApi.open).toHaveBeenCalledWith('a')
    expect(treeApi.open).toHaveBeenCalledWith('b')
    expect(treeApi.open).toHaveBeenCalledWith('c')
  })
})
