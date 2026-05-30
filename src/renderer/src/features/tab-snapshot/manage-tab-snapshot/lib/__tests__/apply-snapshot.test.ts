/**
 * features/tab-snapshot/manage-tab-snapshot/lib/apply-snapshot.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  applyMock: vi.fn()
}))

vi.mock('@/entities/tab-system', () => ({
  applySessionToStore: mocks.applyMock
}))

import { applyTabSnapshot } from '../apply-snapshot'
import type { TabSnapshot } from '@entities/tab-snapshot'

beforeEach(() => {
  mocks.applyMock.mockReset()
})

describe('applyTabSnapshot', () => {
  it('panes/tabs/layout JSON 파싱 + applySessionToStore 호출', () => {
    const snapshot = {
      id: 'snap-1',
      name: '테스트',
      panesJson: JSON.stringify({ main: { id: 'main', activeTabId: 't1', tabIds: ['t1'] } }),
      tabsJson: JSON.stringify({ t1: { id: 't1', type: 'todo', pathname: '/' } }),
      layoutJson: JSON.stringify({ type: 'pane', id: 'main' }),
      createdAt: new Date()
    } as unknown as TabSnapshot

    applyTabSnapshot(snapshot)

    expect(mocks.applyMock).toHaveBeenCalledTimes(1)
    const arg = mocks.applyMock.mock.calls[0][0]
    expect(arg.tabs).toEqual({ t1: { id: 't1', type: 'todo', pathname: '/' } })
    expect(arg.activePaneId).toBe('main')
  })

  it('첫 pane id → activePaneId', () => {
    const snapshot = {
      panesJson: JSON.stringify({
        leftA: { id: 'leftA', activeTabId: null, tabIds: [] },
        rightB: { id: 'rightB', activeTabId: null, tabIds: [] }
      }),
      tabsJson: JSON.stringify({}),
      layoutJson: JSON.stringify({ type: 'pane', id: 'leftA' })
    } as unknown as TabSnapshot

    applyTabSnapshot(snapshot)
    const arg = mocks.applyMock.mock.calls[0][0]
    expect(arg.activePaneId).toBe('leftA')
  })

  it('빈 panes → activePaneId 빈문자', () => {
    const snapshot = {
      panesJson: JSON.stringify({}),
      tabsJson: JSON.stringify({}),
      layoutJson: JSON.stringify({ type: 'pane', id: 'main' })
    } as unknown as TabSnapshot

    applyTabSnapshot(snapshot)
    expect(mocks.applyMock.mock.calls[0][0].activePaneId).toBe('')
  })
})
