import { describe, it, expect } from 'vitest'
import {
  createTabId,
  createTab,
  createPane,
  createPaneNode,
  createSplitContainerNode,
  createInitialState,
  parseSearch
} from '../factory'
import { LAYOUT_DEFAULTS, PANE_DEFAULTS } from '../constants'
import type { PaneNode, SplitNode } from '@/entities/tab-system'

describe('createTabId', () => {
  it('/dashboard → tab-dashboard', () => {
    expect(createTabId('/dashboard')).toBe('tab-dashboard')
  })

  it('/todo/123 → tab-todo-123', () => {
    expect(createTabId('/todo/123')).toBe('tab-todo-123')
  })

  it('연속 슬래시를 단일 하이픈으로 정규화한다', () => {
    expect(createTabId('/a//b')).toBe('tab-a-b')
  })

  it('/ (루트 경로)는 tab- 를 반환한다', () => {
    // 특수문자만 있는 경로: 알파벳/숫자가 없으므로 빈 suffix가 되어 'tab-' 반환
    expect(createTabId('/')).toBe('tab-')
  })

  it('숫자와 영문자는 유지한다', () => {
    expect(createTabId('/note/abc123')).toBe('tab-note-abc123')
  })
})

describe('createTab', () => {
  const baseOptions = { type: 'dashboard' as const, pathname: '/dashboard', title: '대시보드' }

  it('pathname 기반 id를 생성한다', () => {
    expect(createTab(baseOptions).id).toBe('tab-dashboard')
  })

  it('icon이 type과 동일하다', () => {
    const tab = createTab(baseOptions)
    expect(tab.icon).toBe(tab.type)
  })

  it('pinned 기본값은 false다', () => {
    expect(createTab(baseOptions).pinned).toBe(false)
  })

  it('pinned: true 옵션이 적용된다', () => {
    expect(createTab({ ...baseOptions, pinned: true }).pinned).toBe(true)
  })

  it('searchParams 옵션이 적용된다', () => {
    const tab = createTab({ ...baseOptions, searchParams: { filter: 'all' } })
    expect(tab.searchParams).toEqual({ filter: 'all' })
  })

  it('searchParams 없으면 undefined다', () => {
    expect(createTab(baseOptions).searchParams).toBeUndefined()
  })

  it('createdAt과 lastAccessedAt은 숫자다', () => {
    const tab = createTab(baseOptions)
    expect(typeof tab.createdAt).toBe('number')
    expect(typeof tab.lastAccessedAt).toBe('number')
  })

  it('생성 직후 createdAt과 lastAccessedAt이 동일하다', () => {
    const tab = createTab(baseOptions)
    expect(tab.createdAt).toBe(tab.lastAccessedAt)
  })
})

describe('createPane', () => {
  it('기본 패인을 생성한다', () => {
    const pane = createPane()
    expect(typeof pane.id).toBe('string')
    expect(pane.tabIds).toEqual([])
    expect(pane.activeTabId).toBeNull()
    expect(pane.size).toBe(PANE_DEFAULTS.DEFAULT_SIZE)
    expect(pane.minSize).toBe(PANE_DEFAULTS.MIN_SIZE)
  })

  it('커스텀 id를 사용할 수 있다', () => {
    expect(createPane({ id: 'custom-id' }).id).toBe('custom-id')
  })

  it('초기 tabIds와 activeTabId를 설정할 수 있다', () => {
    const pane = createPane({ tabIds: ['tab-a', 'tab-b'], activeTabId: 'tab-a' })
    expect(pane.tabIds).toEqual(['tab-a', 'tab-b'])
    expect(pane.activeTabId).toBe('tab-a')
  })

  it('id를 지정하지 않으면 nanoid로 고유값을 생성한다', () => {
    const pane1 = createPane()
    const pane2 = createPane()
    expect(pane1.id).not.toBe(pane2.id)
  })
})

describe('createInitialState', () => {
  it('탭 1개, 패인 1개로 초기 상태를 만든다', () => {
    const state = createInitialState()
    expect(Object.keys(state.tabs)).toHaveLength(1)
    expect(Object.keys(state.panes)).toHaveLength(1)
  })

  it('activePaneId가 DEFAULT_PANE_ID다', () => {
    expect(createInitialState().activePaneId).toBe(LAYOUT_DEFAULTS.DEFAULT_PANE_ID)
  })

  it('layout은 PaneNode 타입이다', () => {
    expect(createInitialState().layout.type).toBe('pane')
  })

  it('대시보드 탭의 pathname은 /dashboard다', () => {
    const tab = Object.values(createInitialState().tabs)[0]
    expect(tab.pathname).toBe('/dashboard')
    expect(tab.type).toBe('dashboard')
  })
})

describe('createPaneNode', () => {
  it('paneId를 가진 PaneNode를 생성한다', () => {
    const node = createPaneNode('pane-123') as PaneNode
    expect(node.type).toBe('pane')
    expect(node.paneId).toBe('pane-123')
    expect(typeof node.id).toBe('string')
  })

  it('호출할 때마다 고유한 id를 생성한다', () => {
    const n1 = createPaneNode('pane-1')
    const n2 = createPaneNode('pane-1')
    expect(n1.id).not.toBe(n2.id)
  })
})

describe('createSplitContainerNode', () => {
  it('SplitNode를 생성한다', () => {
    const children = [createPaneNode('p1'), createPaneNode('p2')]
    const node = createSplitContainerNode('horizontal', children) as SplitNode

    expect(node.type).toBe('split')
    expect(node.direction).toBe('horizontal')
    expect(node.children).toHaveLength(2)
    expect(typeof node.id).toBe('string')
  })

  it('sizes를 명시하지 않으면 균등 분배한다', () => {
    const children = [createPaneNode('p1'), createPaneNode('p2')]
    const node = createSplitContainerNode('horizontal', children) as SplitNode
    expect(node.sizes).toEqual([50, 50])
  })

  it('sizes를 명시하면 해당 값을 사용한다', () => {
    const children = [createPaneNode('p1'), createPaneNode('p2')]
    const node = createSplitContainerNode('horizontal', children, [30, 70]) as SplitNode
    expect(node.sizes).toEqual([30, 70])
  })

  it('자식 3개일 때 sizes가 균등 분배된다', () => {
    const children = [createPaneNode('p1'), createPaneNode('p2'), createPaneNode('p3')]
    const node = createSplitContainerNode('vertical', children) as SplitNode
    node.sizes.forEach((s) => expect(s).toBeCloseTo(33.33))
  })
})

describe('parseSearch', () => {
  it('? 포함 쿼리 문자열을 파싱한다', () => {
    expect(parseSearch('?a=1&b=2')).toEqual({ a: '1', b: '2' })
  })

  it('? 없는 쿼리 문자열을 파싱한다', () => {
    expect(parseSearch('key=value')).toEqual({ key: 'value' })
  })

  it('빈 문자열이면 빈 객체를 반환한다', () => {
    expect(parseSearch('')).toEqual({})
  })

  it('여러 파라미터를 파싱한다', () => {
    expect(parseSearch('?x=1&y=2&z=3')).toEqual({ x: '1', y: '2', z: '3' })
  })
})
