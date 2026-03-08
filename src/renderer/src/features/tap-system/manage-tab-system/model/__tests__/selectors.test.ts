import { describe, it, expect } from 'vitest'
import {
  selectTab,
  selectPaneByTabId,
  selectTabByPathname,
  selectPane,
  selectActiveTab,
  selectActivePane,
  selectPaneCount
} from '../selectors'
import type { TabState } from '../types'
import type { Tab, Pane, PaneNode } from '@/entities/tab-system'

function makeTab(overrides?: Partial<Tab>): Tab {
  return {
    id: 'tab-dashboard',
    type: 'dashboard',
    title: '대시보드',
    icon: 'dashboard',
    pathname: '/dashboard',
    pinned: false,
    createdAt: 1000,
    lastAccessedAt: 1000,
    ...overrides
  }
}

function makePane(overrides?: Partial<Pane>): Pane {
  return {
    id: 'pane-main',
    tabIds: ['tab-dashboard'],
    activeTabId: 'tab-dashboard',
    size: 50,
    minSize: 200,
    ...overrides
  }
}

function makeState(
  overrides?: Partial<Pick<TabState, 'tabs' | 'panes' | 'activePaneId' | 'layout'>>
): TabState {
  const tab = makeTab()
  const pane = makePane()
  const layout: PaneNode = { id: 'layout-1', type: 'pane', paneId: 'pane-main' }

  return {
    tabs: { 'tab-dashboard': tab },
    panes: { 'pane-main': pane },
    layout,
    activePaneId: 'pane-main',
    ...overrides
  }
}

describe('selectTab', () => {
  it('id로 탭을 반환한다', () => {
    expect(selectTab('tab-dashboard')(makeState())?.id).toBe('tab-dashboard')
  })

  it('존재하지 않는 id면 undefined를 반환한다', () => {
    expect(selectTab('tab-x')(makeState())).toBeUndefined()
  })
})

describe('selectPaneByTabId', () => {
  it('탭이 속한 패인을 반환한다', () => {
    expect(selectPaneByTabId('tab-dashboard')(makeState())?.id).toBe('pane-main')
  })

  it('존재하지 않는 tabId면 undefined를 반환한다', () => {
    expect(selectPaneByTabId('tab-x')(makeState())).toBeUndefined()
  })

  it('여러 패인이 있을 때 올바른 패인을 찾는다', () => {
    const pane2 = makePane({ id: 'pane-2', tabIds: ['tab-todo'], activeTabId: 'tab-todo' })
    const tab2 = makeTab({ id: 'tab-todo', pathname: '/todo' })
    const state = makeState({
      panes: { 'pane-main': makePane(), 'pane-2': pane2 },
      tabs: { 'tab-dashboard': makeTab(), 'tab-todo': tab2 }
    })
    expect(selectPaneByTabId('tab-todo')(state)?.id).toBe('pane-2')
  })
})

describe('selectTabByPathname', () => {
  it('pathname으로 탭을 반환한다', () => {
    expect(selectTabByPathname('/dashboard')(makeState())?.id).toBe('tab-dashboard')
  })

  it('존재하지 않는 pathname이면 undefined를 반환한다', () => {
    expect(selectTabByPathname('/unknown')(makeState())).toBeUndefined()
  })
})

describe('selectPane', () => {
  it('id로 패인을 반환한다', () => {
    expect(selectPane('pane-main')(makeState())?.id).toBe('pane-main')
  })

  it('존재하지 않는 id면 undefined를 반환한다', () => {
    expect(selectPane('pane-x')(makeState())).toBeUndefined()
  })
})

describe('selectActiveTab', () => {
  it('activePaneId 기준으로 활성 탭을 반환한다', () => {
    expect(selectActiveTab()(makeState())?.id).toBe('tab-dashboard')
  })

  it('paneId를 명시하면 해당 패인의 활성 탭을 반환한다', () => {
    expect(selectActiveTab('pane-main')(makeState())?.id).toBe('tab-dashboard')
  })

  it('activeTabId가 null이면 undefined를 반환한다', () => {
    const state = makeState({
      panes: { 'pane-main': makePane({ activeTabId: null }) }
    })
    expect(selectActiveTab()(state)).toBeUndefined()
  })

  it('존재하지 않는 paneId면 undefined를 반환한다', () => {
    expect(selectActiveTab('pane-x')(makeState())).toBeUndefined()
  })
})

describe('selectActivePane', () => {
  it('activePaneId에 해당하는 패인을 반환한다', () => {
    expect(selectActivePane(makeState())?.id).toBe('pane-main')
  })
})

describe('selectPaneCount', () => {
  it('패인이 1개면 1을 반환한다', () => {
    expect(selectPaneCount(makeState())).toBe(1)
  })

  it('패인이 여러 개면 정확한 수를 반환한다', () => {
    const state = makeState({
      panes: {
        'pane-main': makePane(),
        'pane-2': makePane({ id: 'pane-2' })
      }
    })
    expect(selectPaneCount(state)).toBe(2)
  })
})
