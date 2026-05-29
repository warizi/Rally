/**
 * widgets/keyboard-control/model/use-snapshot-navigation.test.ts
 *
 * cmd+shift+s 스냅샷 nav. useTabSnapshots 모킹 + applyTabSnapshot 모킹.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  snapshots: [] as Array<{ id: string; name: string; description: string | null }>,
  workspaceId: 'ws-1' as string | null,
  applyTabSnapshot: vi.fn(),
  hotkey: {
    onKeyDown: null as null | ((e: KeyboardEvent) => void),
    onDeactivate: null as null | (() => void)
  }
}))

vi.mock('../use-global-hotkey', () => ({
  useGlobalHotkey: (opts: {
    onKeyDown?: (e: KeyboardEvent) => void
    onDeactivate?: () => void
  }) => {
    mocks.hotkey.onKeyDown = opts.onKeyDown ?? null
    mocks.hotkey.onDeactivate = opts.onDeactivate ?? null
  }
}))
vi.mock('@entities/tab-snapshot', () => ({
  useTabSnapshots: () => ({ data: mocks.snapshots })
}))
vi.mock('@/shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@/features/tab-snapshot/manage-tab-snapshot', () => ({
  applyTabSnapshot: (s: unknown) => mocks.applyTabSnapshot(s)
}))

import { useSnapshotNavStore } from '../snapshot-nav-store'
import { useKeyboardModeStore } from '../keyboard-mode-store'
import { useSnapshotNavigation } from '../use-snapshot-navigation'

function key(code: string): KeyboardEvent {
  return { code, preventDefault: vi.fn() } as unknown as KeyboardEvent
}

beforeEach(() => {
  mocks.snapshots = []
  mocks.workspaceId = 'ws-1'
  mocks.applyTabSnapshot.mockClear()
  useSnapshotNavStore.getState().close()
  useKeyboardModeStore.setState({ mode: null })
  mocks.hotkey.onKeyDown = null
  mocks.hotkey.onDeactivate = null
})

describe('useSnapshotNavigation', () => {
  it('s 키 외엔 무시', () => {
    mocks.snapshots = [{ id: 's1', name: 'S1', description: null }]
    renderHook(() => useSnapshotNavigation())
    mocks.hotkey.onKeyDown?.(key('KeyA'))
    expect(useSnapshotNavStore.getState().open).toBe(false)
  })

  it('스냅샷 0 개 → 첫 s 키도 무시', () => {
    mocks.snapshots = []
    renderHook(() => useSnapshotNavigation())
    mocks.hotkey.onKeyDown?.(key('KeyS'))
    expect(useSnapshotNavStore.getState().open).toBe(false)
    expect(useKeyboardModeStore.getState().mode).toBe(null)
  })

  it('스냅샷 있음 + 첫 s → start + mode=snapshot-nav', () => {
    mocks.snapshots = [
      { id: 's1', name: 'one', description: null },
      { id: 's2', name: 'two', description: 'desc' }
    ]
    renderHook(() => useSnapshotNavigation())
    mocks.hotkey.onKeyDown?.(key('KeyS'))
    expect(useSnapshotNavStore.getState().open).toBe(true)
    expect(useSnapshotNavStore.getState().items.map((it) => it.snapshotId)).toEqual(['s1', 's2'])
    expect(useSnapshotNavStore.getState().focusIndex).toBe(0)
    expect(useKeyboardModeStore.getState().mode).toBe('snapshot-nav')
  })

  it('두번째 s → next (focusIndex 증가)', () => {
    mocks.snapshots = [
      { id: 's1', name: 'one', description: null },
      { id: 's2', name: 'two', description: null }
    ]
    renderHook(() => useSnapshotNavigation())
    mocks.hotkey.onKeyDown?.(key('KeyS'))
    mocks.hotkey.onKeyDown?.(key('KeyS'))
    expect(useSnapshotNavStore.getState().focusIndex).toBe(1)
  })

  it('deactivate (modifier 해제) → focus snapshot 적용 + close + mode clear', () => {
    mocks.snapshots = [
      { id: 's1', name: 'one', description: null },
      { id: 's2', name: 'two', description: null }
    ]
    renderHook(() => useSnapshotNavigation())
    mocks.hotkey.onKeyDown?.(key('KeyS'))
    mocks.hotkey.onKeyDown?.(key('KeyS')) // focusIndex=1
    mocks.hotkey.onDeactivate?.()
    expect(mocks.applyTabSnapshot).toHaveBeenCalledWith(mocks.snapshots[1])
    expect(useSnapshotNavStore.getState().open).toBe(false)
    expect(useKeyboardModeStore.getState().mode).toBe(null)
  })

  it('open=false 일 때 deactivate → applyTabSnapshot 안 호출', () => {
    renderHook(() => useSnapshotNavigation())
    mocks.hotkey.onDeactivate?.()
    expect(mocks.applyTabSnapshot).not.toHaveBeenCalled()
  })
})
