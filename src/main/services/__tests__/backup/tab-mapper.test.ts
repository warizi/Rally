/**
 * tab-mapper 단위 테스트 (P0-2 Phase 4 커버리지 보강).
 *
 * tab-mapper.ts 는 backup.test.ts 의 라운드트립에서 tab session 시드 없이는
 * 실행되지 않음. 별도 단위 테스트로 함수별 직접 검증.
 */
import { describe, it, expect } from 'vitest'
import {
  mapTabPathname,
  createTabId,
  mapFolderOpenState,
  mapTabJsons
} from '../../backup/tab-mapper'
import { IdMapper } from '../../backup/id-mapper'

describe('mapTabPathname', () => {
  it.each([
    ['/todo/abc', 'todo'],
    ['/folder/note/n1', 'note'],
    ['/folder/csv/c1', 'csv'],
    ['/folder/pdf/p1', 'pdf'],
    ['/folder/image/i1', 'image'],
    ['/canvas/cv1', 'canvas']
  ] as const)('pattern %s → maps id with type %s', (pathname, type) => {
    const mapper = new IdMapper()
    const oldId = pathname.split('/').pop()!
    const newId = mapper.register(type, oldId)
    expect(mapper.size(type)).toBe(1)

    const result = mapTabPathname(pathname, mapper)
    expect(result.mapped).toBe(true)
    expect(result.pathname).toContain(newId)
  })

  it('returns mapped=false when entity id is not registered (orphan tab)', () => {
    const mapper = new IdMapper()
    const result = mapTabPathname('/todo/missing-id', mapper)
    expect(result.mapped).toBe(false)
    expect(result.pathname).toBe('/todo/missing-id')
  })

  it('pathname without entity id (e.g. /dashboard) passes through unchanged', () => {
    const mapper = new IdMapper()
    const result = mapTabPathname('/dashboard', mapper)
    expect(result.mapped).toBe(true)
    expect(result.pathname).toBe('/dashboard')
  })
})

describe('createTabId', () => {
  it('replaces non-alphanumeric with single dashes + trims edges', () => {
    expect(createTabId('/todo/abc-123')).toBe('tab-todo-abc-123')
    expect(createTabId('//multi//slash')).toBe('tab-multi-slash')
    expect(createTabId('/한글/no-allowed')).toBe('tab-no-allowed')
  })
})

describe('mapFolderOpenState', () => {
  it('returns input unchanged when undefined', () => {
    const mapper = new IdMapper()
    expect(mapFolderOpenState(undefined, mapper)).toBeUndefined()
  })

  it('maps folder ids and drops unmapped', () => {
    const mapper = new IdMapper()
    const f1New = mapper.register('folder', 'f1-old')
    // f2-old 는 미등록 → 결과에서 제외

    const json = JSON.stringify({ 'f1-old': true, 'f2-old': false })
    const mapped = mapFolderOpenState(json, mapper)
    expect(mapped).toBeDefined()
    const parsed = JSON.parse(mapped!) as Record<string, boolean>
    expect(parsed[f1New]).toBe(true)
    expect(Object.keys(parsed)).toHaveLength(1)
  })

  it('throws on malformed JSON (silent fallback 0)', () => {
    const mapper = new IdMapper()
    expect(() => mapFolderOpenState('not-a-json', mapper)).toThrow(
      /Invalid folderOpenState JSON/
    )
  })

  it('throws on non-object JSON (array)', () => {
    const mapper = new IdMapper()
    expect(() => mapFolderOpenState(JSON.stringify([1, 2]), mapper)).toThrow(
      /expected an object map/
    )
  })

  it('throws on non-boolean entry value', () => {
    const mapper = new IdMapper()
    mapper.register('folder', 'f1')
    expect(() =>
      mapFolderOpenState(JSON.stringify({ f1: 'not-boolean' }), mapper)
    ).toThrow(/not boolean/)
  })
})

describe('mapTabJsons', () => {
  function fixture() {
    const mapper = new IdMapper()
    const todoNew = mapper.register('todo', 'todo-old')

    const tabsJson = JSON.stringify({
      'tab-old': {
        id: 'tab-old',
        type: 'todo',
        title: 'Todo Tab',
        icon: 'check',
        pathname: '/todo/todo-old',
        searchParams: {},
        pinned: false,
        createdAt: 100,
        lastAccessedAt: 200
      }
    })
    const panesJson = JSON.stringify({
      'pane-old': {
        id: 'pane-old',
        tabIds: ['tab-old'],
        activeTabId: 'tab-old',
        size: 100,
        minSize: 10
      }
    })
    const layoutJson = JSON.stringify({
      id: 'root',
      type: 'pane',
      paneId: 'pane-old'
    })
    return { mapper, todoNew, tabsJson, panesJson, layoutJson }
  }

  it('remaps tab pathnames + pane ids + layout pane refs', () => {
    const { mapper, todoNew, tabsJson, panesJson, layoutJson } = fixture()
    const result = mapTabJsons(tabsJson, panesJson, layoutJson, 'pane-old', mapper)

    const tabs = JSON.parse(result.tabsJson) as Record<
      string,
      { pathname: string }
    >
    const panes = JSON.parse(result.panesJson) as Record<
      string,
      { tabIds: string[]; activeTabId: string | null }
    >
    const layout = JSON.parse(result.layoutJson) as {
      type: 'pane'
      paneId: string
    }

    // tab id 가 새 path 기반으로 생성됨
    const newTabId = Object.keys(tabs)[0]
    expect(tabs[newTabId].pathname).toContain(todoNew)
    // pane 의 tabIds 가 새 tab id 로 매핑됨
    const newPaneId = Object.keys(panes)[0]
    expect(panes[newPaneId].tabIds).toEqual([newTabId])
    expect(panes[newPaneId].activeTabId).toBe(newTabId)
    // layout 의 paneId 도 새 pane id 로 매핑
    expect(layout.paneId).toBe(newPaneId)
    // activePaneId 도 매핑
    expect(result.activePaneId).toBe(newPaneId)
  })

  it('throws on invalid tabsJson (zod parse fail)', () => {
    const mapper = new IdMapper()
    expect(() => mapTabJsons('null', '{}', '{"type":"pane","id":"x","paneId":"y"}', null, mapper))
      .toThrow(/Invalid tabsJson/)
  })

  it('throws on invalid panesJson', () => {
    const mapper = new IdMapper()
    expect(() => mapTabJsons('{}', 'null', '{"type":"pane","id":"x","paneId":"y"}', null, mapper))
      .toThrow(/Invalid panesJson/)
  })

  it('throws on invalid layoutJson', () => {
    const mapper = new IdMapper()
    expect(() => mapTabJsons('{}', '{}', 'null', null, mapper)).toThrow(/Invalid layoutJson/)
  })

  it('handles split layout node recursively', () => {
    const mapper = new IdMapper()
    const panesJson = JSON.stringify({
      'p1': {
        id: 'p1',
        tabIds: [],
        activeTabId: null,
        size: 50,
        minSize: 10
      },
      'p2': {
        id: 'p2',
        tabIds: [],
        activeTabId: null,
        size: 50,
        minSize: 10
      }
    })
    const layoutJson = JSON.stringify({
      id: 'root',
      type: 'split',
      direction: 'horizontal',
      sizes: [50, 50],
      children: [
        { id: 'l1', type: 'pane', paneId: 'p1' },
        { id: 'l2', type: 'pane', paneId: 'p2' }
      ]
    })
    const result = mapTabJsons('{}', panesJson, layoutJson, null, mapper)
    const layout = JSON.parse(result.layoutJson) as {
      type: 'split'
      children: Array<{ type: 'pane'; paneId: string }>
    }
    expect(layout.type).toBe('split')
    expect(layout.children).toHaveLength(2)
  })
})
