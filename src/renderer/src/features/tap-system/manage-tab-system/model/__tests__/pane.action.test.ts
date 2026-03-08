import { describe, it, expect, beforeEach } from 'vitest'
import { useTabStore } from '../store'

const MAIN_PANE = 'main'
const DASHBOARD_TAB = 'tab-dashboard'

beforeEach(() => {
  useTabStore.getState().reset()
})

// ─── setActivePane ────────────────────────────────────
describe('setActivePane', () => {
  it('activePaneId를 변경한다', () => {
    // splitPane 후 activePaneId = newPaneId

    useTabStore.getState().setActivePane(MAIN_PANE)

    expect(useTabStore.getState().activePaneId).toBe(MAIN_PANE)
  })

  it('존재하지 않는 paneId면 무시한다', () => {
    useTabStore.getState().setActivePane('pane-x')
    expect(useTabStore.getState().activePaneId).toBe(MAIN_PANE)
  })
})

// ─── splitPane ────────────────────────────────────────
describe('splitPane', () => {
  it('오른쪽으로 분할하고 새 패인 ID를 반환한다', () => {
    const newPaneId = useTabStore.getState().splitPane(MAIN_PANE, 'right')

    const state = useTabStore.getState()
    expect(newPaneId).not.toBe(MAIN_PANE)
    expect(state.panes[newPaneId]).toBeDefined()
    expect(state.activePaneId).toBe(newPaneId)
  })

  it('분할 후 레이아웃이 SplitNode가 된다', () => {
    useTabStore.getState().splitPane(MAIN_PANE, 'right')
    expect(useTabStore.getState().layout.type).toBe('split')
  })

  it('왼쪽으로도 분할할 수 있다', () => {
    const newPaneId = useTabStore.getState().splitPane(MAIN_PANE, 'left')
    expect(useTabStore.getState().panes[newPaneId]).toBeDefined()
  })

  it('tabId 지정 시 해당 탭이 새 패인으로 이동하고 빈 소스 패인은 제거된다', () => {
    const newPaneId = useTabStore.getState().splitPane(MAIN_PANE, 'right', DASHBOARD_TAB)

    const state = useTabStore.getState()
    expect(state.panes[newPaneId].tabIds).toContain(DASHBOARD_TAB)
    expect(state.panes[MAIN_PANE]).toBeUndefined()
  })

  it('존재하지 않는 paneId면 원래 paneId를 반환하고 상태가 변경되지 않는다', () => {
    const panesBefore = Object.keys(useTabStore.getState().panes)
    const layoutBefore = useTabStore.getState().layout

    const result = useTabStore.getState().splitPane('pane-x', 'right')

    expect(result).toBe('pane-x')
    expect(Object.keys(useTabStore.getState().panes)).toEqual(panesBefore)
    expect(useTabStore.getState().layout).toEqual(layoutBefore)
  })

  it('같은 방향으로 연속 분할하면 sizes가 균등해진다', () => {
    const store = useTabStore.getState()
    store.splitPane(MAIN_PANE, 'right')
    const layout = useTabStore.getState().layout
    expect(layout.type).toBe('split')
    if (layout.type === 'split') {
      const sum = layout.sizes.reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(100)
    }
  })

  it('위로 분할하면 vertical SplitNode를 생성한다', () => {
    useTabStore.getState().splitPane(MAIN_PANE, 'top')
    const layout = useTabStore.getState().layout
    expect(layout.type).toBe('split')
    if (layout.type === 'split') {
      expect(layout.direction).toBe('vertical')
    }
  })

  it('아래로 분할하면 vertical SplitNode를 생성한다', () => {
    useTabStore.getState().splitPane(MAIN_PANE, 'bottom')
    const layout = useTabStore.getState().layout
    expect(layout.type).toBe('split')
    if (layout.type === 'split') {
      expect(layout.direction).toBe('vertical')
    }
  })
})

// ─── closePane ────────────────────────────────────────
describe('closePane', () => {
  it('유일한 패인은 닫을 수 없다', () => {
    useTabStore.getState().closePane(MAIN_PANE)
    expect(useTabStore.getState().panes[MAIN_PANE]).toBeDefined()
  })

  it('패인과 그 탭들을 모두 제거한다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')
    store.openTab({ type: 'todo', pathname: '/todo', title: '할일' }, newPaneId)

    useTabStore.getState().closePane(newPaneId)

    const state = useTabStore.getState()
    expect(state.panes[newPaneId]).toBeUndefined()
    expect(state.tabs['tab-todo']).toBeUndefined()
  })

  it('활성 패인을 닫으면 다른 패인이 활성화된다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')
    // splitPane 후 activePaneId = newPaneId

    useTabStore.getState().closePane(newPaneId)

    expect(useTabStore.getState().activePaneId).not.toBe(newPaneId)
    expect(useTabStore.getState().panes[MAIN_PANE]).toBeDefined()
  })

  it('닫힌 패인이 레이아웃에서 제거된다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')

    useTabStore.getState().closePane(newPaneId)

    // 패인이 2개에서 1개로 줄었으므로 layout이 PaneNode여야 함
    expect(useTabStore.getState().layout.type).toBe('pane')
  })
})

// ─── moveTabToPane ────────────────────────────────────
describe('moveTabToPane', () => {
  it('탭을 소스 패인에서 타깃 패인으로 이동한다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')

    useTabStore.getState().moveTabToPane(DASHBOARD_TAB, MAIN_PANE, newPaneId)

    const state = useTabStore.getState()
    expect(state.panes[newPaneId].tabIds).toContain(DASHBOARD_TAB)
    expect(state.panes[MAIN_PANE]?.tabIds ?? []).not.toContain(DASHBOARD_TAB)
  })

  it('이동한 탭이 타깃 패인의 activeTabId가 된다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')
    store.openTab({ type: 'todo', pathname: '/todo', title: '할일' }, newPaneId)

    useTabStore.getState().moveTabToPane(DASHBOARD_TAB, MAIN_PANE, newPaneId)

    expect(useTabStore.getState().panes[newPaneId].activeTabId).toBe(DASHBOARD_TAB)
  })

  it('소스 패인이 비면 소스 패인도 제거된다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')
    // main 패인에는 dashboard 탭 1개뿐

    useTabStore.getState().moveTabToPane(DASHBOARD_TAB, MAIN_PANE, newPaneId)

    expect(useTabStore.getState().panes[MAIN_PANE]).toBeUndefined()
  })

  it('sourcePaneId === targetPaneId면 무시한다', () => {
    useTabStore.getState().moveTabToPane(DASHBOARD_TAB, MAIN_PANE, MAIN_PANE)

    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).toContain(DASHBOARD_TAB)
  })

  it('존재하지 않는 탭이면 무시한다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')

    expect(() => useTabStore.getState().moveTabToPane('tab-x', MAIN_PANE, newPaneId)).not.toThrow()
  })

  it('타깃 패인에 이미 같은 탭이 있으면 중복 추가되지 않는다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')
    // newPane에 todo 탭 추가
    store.openTab({ type: 'todo', pathname: '/todo', title: '할일' }, newPaneId)
    // dashboard 탭을 main → newPane으로 이동
    store.moveTabToPane(DASHBOARD_TAB, MAIN_PANE, newPaneId)
    // 한 번 더 이동 시도 (이미 newPane에 있음) — 중복 추가 없어야 함
    store.moveTabToPane(DASHBOARD_TAB, MAIN_PANE, newPaneId)

    const dashboardCount = useTabStore
      .getState()
      .panes[newPaneId].tabIds.filter((id) => id === DASHBOARD_TAB).length
    expect(dashboardCount).toBe(1)
  })

  it('이동한 탭이 소스 패인의 activeTabId였으면 인접 탭이 활성화된다', () => {
    const store = useTabStore.getState()
    // main 패인에 탭 2개 (dashboard + todo)
    const todoTabId = store.openTab({ type: 'todo', pathname: '/todo', title: '할일' })
    // todo 탭 활성화
    store.activateTab(todoTabId)

    const newPaneId = store.splitPane(MAIN_PANE, 'right')
    // todo 탭을 새 패인으로 이동 → main 패인 activeTabId가 dashboard로 변경되어야 함
    useTabStore.getState().moveTabToPane(todoTabId, MAIN_PANE, newPaneId)

    expect(useTabStore.getState().panes[MAIN_PANE].activeTabId).toBe(DASHBOARD_TAB)
  })
})

// ─── updateLayoutSizes ────────────────────────────────
describe('updateLayoutSizes', () => {
  it('SplitNode의 sizes를 업데이트한다', () => {
    useTabStore.getState().splitPane(MAIN_PANE, 'right')

    const layout = useTabStore.getState().layout
    expect(layout.type).toBe('split')
    if (layout.type !== 'split') return

    useTabStore.getState().updateLayoutSizes(layout.id, [70, 30])

    const newLayout = useTabStore.getState().layout
    expect(newLayout.type).toBe('split')
    if (newLayout.type === 'split') {
      expect(newLayout.sizes).toEqual([70, 30])
    }
  })

  it('존재하지 않는 nodeId면 레이아웃이 변경되지 않는다', () => {
    useTabStore.getState().splitPane(MAIN_PANE, 'right')
    const layoutBefore = useTabStore.getState().layout

    useTabStore.getState().updateLayoutSizes('node-x', [60, 40])

    expect(useTabStore.getState().layout).toEqual(layoutBefore)
  })
})
