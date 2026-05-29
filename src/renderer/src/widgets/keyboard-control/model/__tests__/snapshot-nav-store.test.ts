/**
 * widgets/keyboard-control/model/snapshot-nav-store.test.ts
 *
 * snapshot-nav store actions: start / next / close + 순환 동작.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useSnapshotNavStore } from '../snapshot-nav-store'

beforeEach(() => {
  useSnapshotNavStore.getState().close()
})

describe('useSnapshotNavStore', () => {
  it('초기 상태', () => {
    const state = useSnapshotNavStore.getState()
    expect(state.open).toBe(false)
    expect(state.items).toEqual([])
    expect(state.focusIndex).toBe(0)
  })

  it('start → open=true + items + focusIndex 설정', () => {
    const items = [
      { snapshotId: 's1', name: 'A', description: null },
      { snapshotId: 's2', name: 'B', description: 'desc' }
    ]
    useSnapshotNavStore.getState().start(items, 1)
    const state = useSnapshotNavStore.getState()
    expect(state.open).toBe(true)
    expect(state.items).toEqual(items)
    expect(state.focusIndex).toBe(1)
  })

  it('next → focusIndex 순환', () => {
    useSnapshotNavStore.getState().start(
      [
        { snapshotId: 's1', name: 'A', description: null },
        { snapshotId: 's2', name: 'B', description: null }
      ],
      0
    )
    useSnapshotNavStore.getState().next()
    expect(useSnapshotNavStore.getState().focusIndex).toBe(1)
    useSnapshotNavStore.getState().next()
    expect(useSnapshotNavStore.getState().focusIndex).toBe(0) // 순환
  })

  it('빈 items → next 무시', () => {
    useSnapshotNavStore.getState().start([], 0)
    useSnapshotNavStore.getState().next()
    expect(useSnapshotNavStore.getState().focusIndex).toBe(0)
  })

  it('close → 초기 상태로 reset', () => {
    useSnapshotNavStore.getState().start([{ snapshotId: 's1', name: 'A', description: null }], 0)
    useSnapshotNavStore.getState().close()
    const state = useSnapshotNavStore.getState()
    expect(state.open).toBe(false)
    expect(state.items).toEqual([])
    expect(state.focusIndex).toBe(0)
  })
})
