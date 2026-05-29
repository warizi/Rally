/**
 * widgets/tab-system/model/use-tab-dnd.test.ts
 *
 * Tab drag/drop 핸들러의 분기 — split / tab-list / pane / reorder / ignore.
 * useTabStore 는 실제 store 를 사용한다(reset 으로 격리). 외부 mock 없음.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { useTabStore } from '@/entities/tab-system'
import { useTabDnd, useReorderTabs } from '../use-tab-dnd'

const MAIN_PANE = 'main'

beforeEach(() => {
  useTabStore.getState().reset()
  // reset 후 main pane 에 'tab-dashboard' 가 자동 존재. 일부 테스트 (reorder/find sourcePane)
  // 는 dashboard 가 있다는 전제로 작성됨.
})

function openTab(pathname: string, paneId?: string): string {
  return useTabStore.getState().openTab({ type: 'todo', pathname, title: pathname }, paneId)
}

function makeDragStart(id: string, source?: string): DragStartEvent {
  return { active: { id, data: { current: source ? { source } : undefined } } } as DragStartEvent
}

function makeDragEnd(activeId: string, overId: string | null, source?: string): DragEndEvent {
  return {
    active: { id: activeId, data: { current: source ? { source } : undefined } },
    over: overId ? { id: overId } : null
  } as DragEndEvent
}

describe('useTabDnd handleDragStart', () => {
  it('일반 탭 드래그 → onDragStart 콜백 호출', () => {
    const calls: string[] = []
    const { result } = renderHook(() => useTabDnd({ onDragStart: (id) => calls.push(id) }))
    act(() => result.current.handleDragStart(makeDragStart('tab-x')))
    expect(calls).toEqual(['tab-x'])
  })

  it('source=tree-node 인 드래그 → onDragStart 무시', () => {
    const calls: string[] = []
    const { result } = renderHook(() => useTabDnd({ onDragStart: (id) => calls.push(id) }))
    act(() => result.current.handleDragStart(makeDragStart('tab-x', 'tree-node')))
    expect(calls).toEqual([])
  })
})

describe('useTabDnd handleDragEnd — 분기', () => {
  it('source=tree-node 인 드래그 → onDragEnd 만 호출하고 즉시 return', () => {
    let endCount = 0
    const { result } = renderHook(() => useTabDnd({ onDragEnd: () => (endCount += 1) }))
    const id = openTab('/x')
    act(() => result.current.handleDragEnd(makeDragEnd(id, 'pane:main', 'tree-node')))
    expect(endCount).toBe(1)
  })

  it('over 가 null 이면 onDragEnd 콜백만 부르고 종료', () => {
    let endCount = 0
    const { result } = renderHook(() => useTabDnd({ onDragEnd: () => (endCount += 1) }))
    const id = openTab('/x')
    act(() => result.current.handleDragEnd(makeDragEnd(id, null)))
    expect(endCount).toBe(1)
  })

  it('같은 id 에 드롭 → 변경 없음', () => {
    const { result } = renderHook(() => useTabDnd({}))
    const id = openTab('/x')
    const before = JSON.stringify(useTabStore.getState().panes)
    act(() => result.current.handleDragEnd(makeDragEnd(id, id)))
    expect(JSON.stringify(useTabStore.getState().panes)).toBe(before)
  })

  it('split-zone 드롭 → splitPane 호출 (새 pane 생성)', () => {
    const { result } = renderHook(() => useTabDnd({}))
    const id = openTab('/x')
    const beforeCount = Object.keys(useTabStore.getState().panes).length
    act(() => result.current.handleDragEnd(makeDragEnd(id, `split-zone:${MAIN_PANE}:right`)))
    expect(Object.keys(useTabStore.getState().panes).length).toBe(beforeCount + 1)
  })

  it('tab-list 드롭 (다른 pane) → 탭 이동', () => {
    const { result } = renderHook(() => useTabDnd({}))
    const id = openTab('/x')
    const newPaneId = useTabStore.getState().splitPane(MAIN_PANE, 'right')
    act(() => result.current.handleDragEnd(makeDragEnd(id, `tab-list:${newPaneId}`)))
    expect(useTabStore.getState().panes[newPaneId].tabIds).toContain(id)
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).not.toContain(id)
  })

  it('tab-list 드롭 (같은 pane) → 무시', () => {
    const { result } = renderHook(() => useTabDnd({}))
    const id = openTab('/x')
    act(() => result.current.handleDragEnd(makeDragEnd(id, `tab-list:${MAIN_PANE}`)))
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toContain(id)
  })

  it('pane 드롭 (다른 pane) → 탭 이동', () => {
    const { result } = renderHook(() => useTabDnd({}))
    const id = openTab('/x')
    const newPaneId = useTabStore.getState().splitPane(MAIN_PANE, 'right')
    act(() => result.current.handleDragEnd(makeDragEnd(id, `pane:${newPaneId}`)))
    expect(useTabStore.getState().panes[newPaneId].tabIds).toContain(id)
  })

  it('다른 탭 위에 드롭 (같은 pane) → 순서 변경', () => {
    const { result } = renderHook(() => useTabDnd({}))
    const id1 = openTab('/a')
    const id2 = openTab('/b')
    const id3 = openTab('/c')
    // [dashboard, id1, id2, id3] → id1 을 id3 위치로 드롭
    act(() => result.current.handleDragEnd(makeDragEnd(id1, id3)))
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toEqual(['tab-dashboard', id2, id3, id1])
  })

  it('다른 탭 위에 드롭 (다른 pane) → 순서 변경 안 함 (현재 구현)', () => {
    const { result } = renderHook(() => useTabDnd({}))
    const id1 = openTab('/a')
    const newPaneId = useTabStore.getState().splitPane(MAIN_PANE, 'right')
    const id2 = openTab('/b', newPaneId)
    act(() => result.current.handleDragEnd(makeDragEnd(id1, id2)))
    // 현재 구현은 다른 pane 간 reorder 를 무시
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toContain(id1)
    expect(useTabStore.getState().panes[newPaneId].tabIds).toContain(id2)
  })

  it('sourcePane 을 못 찾으면 return', () => {
    const { result } = renderHook(() => useTabDnd({}))
    const before = useTabStore.getState().panes[MAIN_PANE].tabIds.slice()
    act(() => result.current.handleDragEnd(makeDragEnd('non-existent-tab', `pane:${MAIN_PANE}`)))
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toEqual(before)
  })
})

describe('useReorderTabs', () => {
  it('같은 pane 내 순서 변경', () => {
    const id1 = openTab('/a')
    const id2 = openTab('/b')
    const id3 = openTab('/c')
    const { result } = renderHook(() => useReorderTabs(MAIN_PANE))
    // [dashboard, id1, id2, id3] → id3 을 id1 위치로
    act(() => result.current(id3, id1))
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toEqual(['tab-dashboard', id3, id1, id2])
  })

  it('동일 id reorder → 변화 없음', () => {
    const id1 = openTab('/a')
    const id2 = openTab('/b')
    const before = useTabStore.getState().panes[MAIN_PANE].tabIds.slice()
    const { result } = renderHook(() => useReorderTabs(MAIN_PANE))
    act(() => result.current(id1, id1))
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toEqual(before)
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toContain(id2)
  })

  it('존재하지 않는 pane → no-op', () => {
    const id1 = openTab('/a')
    const before = useTabStore.getState().panes[MAIN_PANE].tabIds.slice()
    const { result } = renderHook(() => useReorderTabs('phantom-pane'))
    act(() => result.current(id1, 'whatever'))
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toEqual(before)
  })

  it('id 가 pane 에 없으면 no-op', () => {
    openTab('/a')
    const before = useTabStore.getState().panes[MAIN_PANE].tabIds.slice()
    const { result } = renderHook(() => useReorderTabs(MAIN_PANE))
    act(() => result.current('not-in-pane', 'also-not'))
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toEqual(before)
  })
})
