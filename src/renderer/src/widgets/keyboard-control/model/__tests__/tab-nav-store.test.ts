/**
 * widgets/keyboard-control/model/tab-nav-store.test.ts
 *
 * tab-nav store actions: start / next / prev / close + 순환 동작.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useTabNavStore } from '../tab-nav-store'

beforeEach(() => {
  useTabNavStore.getState().close()
})

describe('useTabNavStore', () => {
  it('초기 상태', () => {
    const state = useTabNavStore.getState()
    expect(state.open).toBe(false)
    expect(state.items).toEqual([])
    expect(state.focusIndex).toBe(0)
  })

  it('start → open=true + items + focusIndex 설정', () => {
    const items = [
      { tabId: 't1', title: 'A', type: 'note' },
      { tabId: 't2', title: 'B', type: 'todo' }
    ]
    useTabNavStore.getState().start(items, 1)
    const state = useTabNavStore.getState()
    expect(state.open).toBe(true)
    expect(state.items).toEqual(items)
    expect(state.focusIndex).toBe(1)
  })

  it('next → focusIndex 순환', () => {
    useTabNavStore.getState().start(
      [
        { tabId: 't1', title: 'A', type: 'note' },
        { tabId: 't2', title: 'B', type: 'todo' }
      ],
      0
    )
    useTabNavStore.getState().next()
    expect(useTabNavStore.getState().focusIndex).toBe(1)
    useTabNavStore.getState().next()
    expect(useTabNavStore.getState().focusIndex).toBe(0) // 순환
  })

  it('prev → focusIndex 역방향 순환', () => {
    useTabNavStore.getState().start(
      [
        { tabId: 't1', title: 'A', type: 'note' },
        { tabId: 't2', title: 'B', type: 'todo' }
      ],
      0
    )
    useTabNavStore.getState().prev()
    expect(useTabNavStore.getState().focusIndex).toBe(1) // 0 → 1 (wrap)
    useTabNavStore.getState().prev()
    expect(useTabNavStore.getState().focusIndex).toBe(0)
  })

  it('items 비어있을 때 next/prev → focusIndex=0 유지', () => {
    useTabNavStore.getState().start([], 0)
    useTabNavStore.getState().next()
    expect(useTabNavStore.getState().focusIndex).toBe(0)
    useTabNavStore.getState().prev()
    expect(useTabNavStore.getState().focusIndex).toBe(0)
  })

  it('close → 초기 상태로 reset', () => {
    useTabNavStore.getState().start([{ tabId: 't1', title: 'A', type: 'note' }], 0)
    useTabNavStore.getState().close()
    const state = useTabNavStore.getState()
    expect(state.open).toBe(false)
    expect(state.items).toEqual([])
    expect(state.focusIndex).toBe(0)
  })
})
