/**
 * entities/tab-system/model/use-tab-persistence.test.ts
 *
 * applySessionToStore — sessionData null → reset, sessionData 있음 → tabs/panes/layout/activePaneId
 * 복원 + deserializeTab 이 icon=type 으로 채우는지 확인.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useTabStore } from '../store'
import { applySessionToStore, sessionKeys } from '../use-tab-persistence'
import type { SessionData } from '../../api/queries'

beforeEach(() => {
  useTabStore.getState().reset()
})

describe('sessionKeys', () => {
  it('all 은 상수 배열', () => {
    expect(sessionKeys.all).toEqual(['session'])
  })

  it('session(workspaceId) 은 [..., workspaceId]', () => {
    expect(sessionKeys.session('ws-1')).toEqual(['session', 'ws-1'])
  })
})

describe('applySessionToStore', () => {
  it('sessionData === null → store.reset() 호출', () => {
    // 먼저 임의 탭 추가
    useTabStore.getState().openTab({ type: 'todo', pathname: '/x', title: 'X' })
    expect(Object.keys(useTabStore.getState().tabs).length).toBeGreaterThan(1)

    applySessionToStore(null)
    // reset 후엔 dashboard 만 남음
    const tabs = Object.values(useTabStore.getState().tabs)
    expect(tabs.length).toBe(1)
  })

  it('sessionData 있음 → tabs/panes/layout/activePaneId 그대로 복원', () => {
    const session = {
      tabs: {
        t1: {
          id: 't1',
          type: 'note',
          title: 'Note 1',
          pathname: '/folder/note/n-1',
          pinned: false,
          createdAt: 1000,
          lastAccessedAt: 2000
        }
      },
      panes: { p1: { id: 'p1', tabIds: ['t1'], activeTabId: 't1' } },
      layout: { type: 'pane', paneId: 'p1' },
      activePaneId: 'p1'
    }
    applySessionToStore(session as unknown as SessionData)
    const state = useTabStore.getState()
    expect(state.activePaneId).toBe('p1')
    expect(state.tabs['t1']).toMatchObject({
      id: 't1',
      type: 'note',
      title: 'Note 1',
      pathname: '/folder/note/n-1',
      icon: 'note' // type 으로부터 자동 채움
    })
    expect(state.panes['p1'].tabIds).toEqual(['t1'])
  })

  it('직렬화 데이터 searchParams 가 있으면 복원, 없으면 생략', () => {
    const session = {
      tabs: {
        t1: {
          id: 't1',
          type: 'todo',
          title: 'X',
          pathname: '/todo',
          searchParams: { q: 'hello' },
          pinned: true,
          createdAt: 0,
          lastAccessedAt: 0
        },
        t2: {
          id: 't2',
          type: 'todo',
          title: 'Y',
          pathname: '/todo-2',
          pinned: false,
          createdAt: 0,
          lastAccessedAt: 0
        }
      },
      panes: { p: { id: 'p', tabIds: ['t1', 't2'], activeTabId: 't1' } },
      layout: { type: 'pane', paneId: 'p' },
      activePaneId: 'p'
    }
    applySessionToStore(session as unknown as SessionData)
    const state = useTabStore.getState()
    expect(state.tabs['t1'].searchParams).toEqual({ q: 'hello' })
    expect(state.tabs['t1'].pinned).toBe(true)
    expect(state.tabs['t2'].searchParams).toBeUndefined()
  })

  it('error 플래그 있는 탭 → 복원 시 error=true 유지', () => {
    const session = {
      tabs: {
        t1: {
          id: 't1',
          type: 'todo',
          title: 'X',
          pathname: '/x',
          pinned: false,
          createdAt: 0,
          lastAccessedAt: 0,
          error: true
        }
      },
      panes: { p: { id: 'p', tabIds: ['t1'], activeTabId: 't1' } },
      layout: { type: 'pane', paneId: 'p' },
      activePaneId: 'p'
    }
    applySessionToStore(session as unknown as SessionData)
    expect(useTabStore.getState().tabs['t1'].error).toBe(true)
  })
})
