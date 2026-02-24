import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTabStore } from '../store'

const MAIN_PANE = 'main'
const DASHBOARD_TAB = 'tab-dashboard'

beforeEach(() => {
  useTabStore.getState().reset()
})

// ─── openTab ─────────────────────────────────────────
describe('openTab', () => {
  it('새 탭을 활성 패인에 추가하고 활성화한다', () => {
    const tabId = useTabStore.getState().openTab({ type: 'todo', pathname: '/todo', title: '할일' })

    const state = useTabStore.getState()
    expect(state.tabs[tabId]).toBeDefined()
    expect(state.tabs[tabId].pathname).toBe('/todo')
    expect(state.panes[MAIN_PANE].tabIds).toContain(tabId)
    expect(state.panes[MAIN_PANE].activeTabId).toBe(tabId)
  })

  it('같은 pathname 탭이 이미 있으면 중복 생성 없이 활성화만 한다', () => {
    const store = useTabStore.getState()
    const id1 = store.openTab({ type: 'todo', pathname: '/todo', title: '할일' })
    const id2 = store.openTab({ type: 'todo', pathname: '/todo', title: '할일' })

    expect(id1).toBe(id2)
    const todoTabs = Object.values(useTabStore.getState().tabs).filter(
      (t) => t.pathname === '/todo'
    )
    expect(todoTabs).toHaveLength(1)
  })

  it('updateSearchParams가 true면 검색 파라미터를 갱신한다', () => {
    const store = useTabStore.getState()
    store.openTab({ type: 'todo', pathname: '/todo', title: '할일', searchParams: { q: 'old' } })
    store.openTab({
      type: 'todo',
      pathname: '/todo',
      title: '할일',
      searchParams: { q: 'new' },
      updateSearchParams: true
    })

    const tab = useTabStore.getState().tabs['tab-todo']
    expect(tab.searchParams?.q).toBe('new')
  })

  it('targetPaneId를 명시하면 해당 패인에 탭을 연다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')
    const tabId = store.openTab({ type: 'todo', pathname: '/todo', title: '할일' }, newPaneId)

    expect(useTabStore.getState().panes[newPaneId].tabIds).toContain(tabId)
    expect(useTabStore.getState().panes[MAIN_PANE].tabIds).not.toContain(tabId)
  })

  it('존재하지 않는 paneId면 tabs에 탭이 추가되지 않고 빈 ID를 반환한다', () => {
    const returnedId = useTabStore
      .getState()
      .openTab({ type: 'todo', pathname: '/todo', title: '할일' }, 'non-existent-pane')
    expect(useTabStore.getState().tabs['tab-todo']).toBeUndefined()
    expect(returnedId).toBe('')
  })
})

// ─── closeTab ────────────────────────────────────────
describe('closeTab', () => {
  it('탭을 닫으면 tabs에서 제거된다', () => {
    const store = useTabStore.getState()
    const tabId = store.openTab({ type: 'todo', pathname: '/todo', title: '할일' })

    useTabStore.getState().closeTab(tabId)

    expect(useTabStore.getState().tabs[tabId]).toBeUndefined()
  })

  it('닫힌 탭이 activeTab이었으면 인접한 탭이 활성화된다', () => {
    const store = useTabStore.getState()
    const tabId = store.openTab({ type: 'todo', pathname: '/todo', title: '할일' })
    // 현재 activeTabId = tabId

    useTabStore.getState().closeTab(tabId)

    expect(useTabStore.getState().panes[MAIN_PANE].activeTabId).toBe(DASHBOARD_TAB)
  })

  it('패인의 마지막 탭을 닫아도 패인이 1개면 패인은 유지된다', () => {
    useTabStore.getState().closeTab(DASHBOARD_TAB)

    const state = useTabStore.getState()
    expect(state.panes[MAIN_PANE]).toBeDefined()
    expect(state.panes[MAIN_PANE].tabIds).toHaveLength(0)
  })

  it('패인이 여러 개일 때 마지막 탭을 닫으면 패인도 제거된다', () => {
    const store = useTabStore.getState()
    const newPaneId = store.splitPane(MAIN_PANE, 'right')
    const tabId = store.openTab({ type: 'todo', pathname: '/todo', title: '할일' }, newPaneId)

    useTabStore.getState().closeTab(tabId)

    expect(useTabStore.getState().panes[newPaneId]).toBeUndefined()
  })

  it('존재하지 않는 탭을 닫으면 무시한다', () => {
    const stateBefore = { ...useTabStore.getState().tabs }
    useTabStore.getState().closeTab('tab-non-existent')
    expect(useTabStore.getState().tabs).toEqual(stateBefore)
  })
})

// ─── activateTab ─────────────────────────────────────
describe('activateTab', () => {
  it('탭을 활성화하고 activePaneId를 업데이트한다', () => {
    const store = useTabStore.getState()
    const tabId = store.openTab({ type: 'todo', pathname: '/todo', title: '할일' })

    useTabStore.getState().activateTab(DASHBOARD_TAB)
    expect(useTabStore.getState().panes[MAIN_PANE].activeTabId).toBe(DASHBOARD_TAB)

    useTabStore.getState().activateTab(tabId)
    expect(useTabStore.getState().panes[MAIN_PANE].activeTabId).toBe(tabId)
  })

  it('activateTab 후 lastAccessedAt이 갱신된다', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(5000)
      useTabStore.getState().activateTab(DASHBOARD_TAB)
      expect(useTabStore.getState().tabs[DASHBOARD_TAB].lastAccessedAt).toBe(5000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('존재하지 않는 tabId면 무시한다', () => {
    const activeBefore = useTabStore.getState().panes[MAIN_PANE].activeTabId
    useTabStore.getState().activateTab('tab-non-existent')
    expect(useTabStore.getState().panes[MAIN_PANE].activeTabId).toBe(activeBefore)
  })
})

// ─── navigateTab ─────────────────────────────────────
describe('navigateTab', () => {
  it('pathname이 변경되면 탭 id도 새 pathname 기반으로 변경된다', () => {
    useTabStore.getState().navigateTab(DASHBOARD_TAB, { pathname: '/todo' })

    const state = useTabStore.getState()
    expect(state.tabs['tab-dashboard']).toBeUndefined()
    expect(state.tabs['tab-todo']).toBeDefined()
    expect(state.tabs['tab-todo'].pathname).toBe('/todo')
  })

  it('searchParams만 변경하면 탭 id는 유지된다', () => {
    useTabStore.getState().navigateTab(DASHBOARD_TAB, { searchParams: { q: 'test' } })

    const state = useTabStore.getState()
    expect(state.tabs[DASHBOARD_TAB]).toBeDefined()
    expect(state.tabs[DASHBOARD_TAB].searchParams).toEqual({ q: 'test' })
  })

  it('이미 같은 pathname 탭이 있으면 해당 탭을 활성화한다', () => {
    const store = useTabStore.getState()
    const todoTabId = store.openTab({ type: 'todo', pathname: '/todo', title: '할일' })

    store.activateTab(DASHBOARD_TAB)
    store.navigateTab(DASHBOARD_TAB, { pathname: '/todo' })

    expect(useTabStore.getState().panes[MAIN_PANE].activeTabId).toBe(todoTabId)
  })

  it('존재하지 않는 tabId면 무시한다', () => {
    expect(() => useTabStore.getState().navigateTab('tab-x', { pathname: '/todo' })).not.toThrow()
  })

  it('같은 pathname으로 navigate하면 상태가 변경되지 않는다', () => {
    const tabsBefore = { ...useTabStore.getState().tabs }
    useTabStore.getState().navigateTab(DASHBOARD_TAB, { pathname: '/dashboard' })
    expect(useTabStore.getState().tabs).toEqual(tabsBefore)
  })
})

// ─── openRightTab ─────────────────────────────────────
describe('openRightTab', () => {
  it('이미 열린 탭이면 중복 생성 없이 활성화만 한다', () => {
    const store = useTabStore.getState()
    const id1 = store.openRightTab({ type: 'todo', pathname: '/todo', title: '할일' }, MAIN_PANE)
    const id2 = store.openRightTab({ type: 'todo', pathname: '/todo', title: '할일' }, MAIN_PANE)

    expect(id1).toBe(id2)
    const todoTabs = Object.values(useTabStore.getState().tabs).filter(
      (t) => t.pathname === '/todo'
    )
    expect(todoTabs).toHaveLength(1)
  })

  it('오른쪽 패인이 없으면 새 분할 패인을 만들어 탭을 연다', () => {
    const tabId = useTabStore
      .getState()
      .openRightTab({ type: 'todo', pathname: '/todo', title: '할일' }, MAIN_PANE)

    const state = useTabStore.getState()
    expect(Object.keys(state.panes)).toHaveLength(2)
    // 새로 생긴 오른쪽 패인에 탭이 있어야 함
    const newPane = Object.values(state.panes).find((p) => p.id !== MAIN_PANE)
    expect(newPane?.tabIds).toContain(tabId)
  })

  it('이미 오른쪽 패인이 있으면 해당 패인에 탭을 연다', () => {
    const store = useTabStore.getState()
    // 먼저 오른쪽 패인을 만들어 둠
    const rightPaneId = store.splitPane(MAIN_PANE, 'right')

    const tabId = useTabStore
      .getState()
      .openRightTab({ type: 'todo', pathname: '/todo', title: '할일' }, MAIN_PANE)

    expect(useTabStore.getState().panes[rightPaneId].tabIds).toContain(tabId)
    // 불필요한 추가 패인이 생기지 않아야 함
    expect(Object.keys(useTabStore.getState().panes)).toHaveLength(2)
  })

  it('유효하지 않은 sourcePaneId면 활성 패인에 탭을 연다', () => {
    const tabId = useTabStore
      .getState()
      .openRightTab({ type: 'todo', pathname: '/todo', title: '할일' }, 'non-existent-pane')

    const state = useTabStore.getState()
    expect(state.tabs[tabId]).toBeDefined()
    expect(state.panes[MAIN_PANE].tabIds).toContain(tabId)
  })
})

// ─── pinTab / unpinTab ────────────────────────────────
describe('pinTab / unpinTab', () => {
  it('탭을 핀하면 pinned가 true가 된다', () => {
    useTabStore.getState().pinTab(DASHBOARD_TAB)
    expect(useTabStore.getState().tabs[DASHBOARD_TAB].pinned).toBe(true)
  })

  it('탭을 언핀하면 pinned가 false가 된다', () => {
    useTabStore.getState().pinTab(DASHBOARD_TAB)
    useTabStore.getState().unpinTab(DASHBOARD_TAB)
    expect(useTabStore.getState().tabs[DASHBOARD_TAB].pinned).toBe(false)
  })

  it('존재하지 않는 탭이면 무시한다', () => {
    expect(() => useTabStore.getState().pinTab('tab-x')).not.toThrow()
  })
})

// ─── setTabTitle / setTabError ────────────────────────
describe('setTabTitle', () => {
  it('탭 타이틀을 변경한다', () => {
    useTabStore.getState().setTabTitle(DASHBOARD_TAB, '새 타이틀')
    expect(useTabStore.getState().tabs[DASHBOARD_TAB].title).toBe('새 타이틀')
  })

  it('존재하지 않는 탭이면 무시한다', () => {
    expect(() => useTabStore.getState().setTabTitle('tab-x', '타이틀')).not.toThrow()
  })
})

describe('setTabError', () => {
  it('탭 에러 상태를 true로 설정한다', () => {
    useTabStore.getState().setTabError(DASHBOARD_TAB, true)
    expect(useTabStore.getState().tabs[DASHBOARD_TAB].error).toBe(true)
  })

  it('탭 에러 상태를 false로 해제한다', () => {
    useTabStore.getState().setTabError(DASHBOARD_TAB, true)
    useTabStore.getState().setTabError(DASHBOARD_TAB, false)
    expect(useTabStore.getState().tabs[DASHBOARD_TAB].error).toBe(false)
  })
})
