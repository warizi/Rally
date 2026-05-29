/**
 * features/reminder/model/use-reminder-watcher.test.ts
 *
 * reminder:fired push 이벤트 → entityType 별 분기 + 다른 워크스페이스 자동 전환.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  setCurrent: vi.fn(),
  currentWorkspaceId: 'ws-1' as string | null,
  onFiredCallback: null as null | ((data: unknown) => void)
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: {
    getState: () => ({
      currentWorkspaceId: mocks.currentWorkspaceId,
      setCurrentWorkspaceId: mocks.setCurrent
    })
  }
}))

import { useTabStore } from '@/entities/tab-system'
import { useReminderWatcher } from '../use-reminder-watcher'

beforeEach(() => {
  useTabStore.getState().reset()
  mocks.setCurrent.mockClear()
  mocks.currentWorkspaceId = 'ws-1'
  mocks.onFiredCallback = null
  ;(window as unknown as Record<string, unknown>).api = {
    reminder: {
      onFired: vi.fn((cb: (data: unknown) => void) => {
        mocks.onFiredCallback = cb
        return () => {
          mocks.onFiredCallback = null
        }
      })
    }
  }
})

function newTabs(): Array<{ id: string; type: string; pathname: string; title: string }> {
  return Object.values(useTabStore.getState().tabs)
    .filter((t) => t.id !== 'tab-dashboard')
    .map((t) => ({
      id: t.id,
      type: t.type as string,
      pathname: t.pathname,
      title: t.title
    }))
}

describe('useReminderWatcher', () => {
  it('todo entity → /todo/:id 탭 open', () => {
    renderHook(() => useReminderWatcher())
    mocks.onFiredCallback?.({
      entityType: 'todo',
      entityId: 't-1',
      title: 'My Todo',
      workspaceId: 'ws-1'
    })
    const t = newTabs()
    expect(t).toHaveLength(1)
    expect(t[0].pathname).toBe('/todo/t-1')
    expect(t[0].type).toBe('todo-detail')
    expect(t[0].title).toBe('My Todo')
  })

  it('schedule entity → calendar 탭 open', () => {
    renderHook(() => useReminderWatcher())
    mocks.onFiredCallback?.({
      entityType: 'schedule',
      entityId: 'sc-1',
      title: 'Sched',
      workspaceId: 'ws-1'
    })
    const t = newTabs()
    expect(t).toHaveLength(1)
    expect(t[0].pathname).toBe('/calendar')
    expect(t[0].type).toBe('calendar')
  })

  it('알 수 없는 entityType → 탭 안 열림', () => {
    renderHook(() => useReminderWatcher())
    mocks.onFiredCallback?.({
      entityType: 'unknown',
      entityId: 'x',
      title: 'X',
      workspaceId: 'ws-1'
    })
    expect(newTabs()).toHaveLength(0)
  })

  it('다른 워크스페이스 → setCurrentWorkspaceId 호출', () => {
    mocks.currentWorkspaceId = 'ws-1'
    renderHook(() => useReminderWatcher())
    mocks.onFiredCallback?.({
      entityType: 'todo',
      entityId: 't-1',
      title: 'X',
      workspaceId: 'ws-OTHER'
    })
    expect(mocks.setCurrent).toHaveBeenCalledWith('ws-OTHER')
  })

  it('같은 워크스페이스 → setCurrent 호출 안 함', () => {
    mocks.currentWorkspaceId = 'ws-1'
    renderHook(() => useReminderWatcher())
    mocks.onFiredCallback?.({
      entityType: 'todo',
      entityId: 't-1',
      title: 'X',
      workspaceId: 'ws-1'
    })
    expect(mocks.setCurrent).not.toHaveBeenCalled()
  })

  it('workspaceId null → setCurrent 호출 안 함', () => {
    renderHook(() => useReminderWatcher())
    mocks.onFiredCallback?.({
      entityType: 'todo',
      entityId: 't-1',
      title: 'X',
      workspaceId: null
    })
    expect(mocks.setCurrent).not.toHaveBeenCalled()
  })
})
