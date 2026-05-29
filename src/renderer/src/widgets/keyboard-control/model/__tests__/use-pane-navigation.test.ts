/**
 * widgets/keyboard-control/model/use-pane-navigation.test.ts
 *
 * ctrl+shift+화살표 인접 pane 이동. findAdjacentPaneId 모킹.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => {
  return {
    findAdjacent: vi.fn<(...args: unknown[]) => string | null>(),
    hotkey: {
      onActivate: null as null | (() => void),
      onDeactivate: null as null | (() => void),
      onKeyDown: null as null | ((e: KeyboardEvent) => void)
    }
  }
})

vi.mock('../use-global-hotkey', () => ({
  useGlobalHotkey: (opts: {
    onActivate?: () => void
    onDeactivate?: () => void
    onKeyDown?: (e: KeyboardEvent) => void
  }) => {
    mocks.hotkey.onActivate = opts.onActivate ?? null
    mocks.hotkey.onDeactivate = opts.onDeactivate ?? null
    mocks.hotkey.onKeyDown = opts.onKeyDown ?? null
  }
}))
vi.mock(import('@/entities/tab-system/model/layout'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    findAdjacentPaneId: (...args: unknown[]) => mocks.findAdjacent(...args)
  }
})

import { useTabStore } from '@/entities/tab-system'
import { useKeyboardModeStore } from '../keyboard-mode-store'
import { usePaneNavigation } from '../use-pane-navigation'

function key(name: string): KeyboardEvent {
  return { key: name, preventDefault: vi.fn() } as unknown as KeyboardEvent
}

beforeEach(() => {
  useTabStore.getState().reset()
  useKeyboardModeStore.setState({ mode: null })
  mocks.findAdjacent.mockReset()
  mocks.hotkey.onActivate = null
  mocks.hotkey.onDeactivate = null
  mocks.hotkey.onKeyDown = null
})

describe('usePaneNavigation', () => {
  it('onActivate → mode=pane-nav', () => {
    renderHook(() => usePaneNavigation())
    mocks.hotkey.onActivate?.()
    expect(useKeyboardModeStore.getState().mode).toBe('pane-nav')
  })

  it('onDeactivate → mode clear', () => {
    renderHook(() => usePaneNavigation())
    useKeyboardModeStore.setState({ mode: 'pane-nav' })
    mocks.hotkey.onDeactivate?.()
    expect(useKeyboardModeStore.getState().mode).toBe(null)
  })

  it('ArrowRight + findAdjacent 가 새 paneId 반환 → setActivePane 호출', () => {
    const newPaneId = useTabStore.getState().splitPane('main', 'right')
    useTabStore.getState().setActivePane('main')
    mocks.findAdjacent.mockReturnValue(newPaneId)

    renderHook(() => usePaneNavigation())
    mocks.hotkey.onKeyDown?.(key('ArrowRight'))

    expect(mocks.findAdjacent).toHaveBeenCalledWith(expect.anything(), 'main', 'right')
    expect(useTabStore.getState().activePaneId).toBe(newPaneId)
  })

  it('ArrowLeft + findAdjacent 가 현재와 동일 paneId 반환 → setActivePane 호출 안 함', () => {
    mocks.findAdjacent.mockReturnValue('main')
    renderHook(() => usePaneNavigation())
    const before = useTabStore.getState().activePaneId
    mocks.hotkey.onKeyDown?.(key('ArrowLeft'))
    expect(useTabStore.getState().activePaneId).toBe(before)
  })

  it('findAdjacent 가 null 반환 → no-op', () => {
    mocks.findAdjacent.mockReturnValue(null)
    renderHook(() => usePaneNavigation())
    const before = useTabStore.getState().activePaneId
    mocks.hotkey.onKeyDown?.(key('ArrowUp'))
    expect(useTabStore.getState().activePaneId).toBe(before)
  })

  it('방향키가 아닌 key → 무시 (findAdjacent 미호출)', () => {
    renderHook(() => usePaneNavigation())
    mocks.hotkey.onKeyDown?.(key('KeyX'))
    expect(mocks.findAdjacent).not.toHaveBeenCalled()
  })

  it('ArrowUp/Down/Left/Right 모두 매핑됨', () => {
    mocks.findAdjacent.mockReturnValue(null)
    renderHook(() => usePaneNavigation())
    mocks.hotkey.onKeyDown?.(key('ArrowUp'))
    mocks.hotkey.onKeyDown?.(key('ArrowDown'))
    mocks.hotkey.onKeyDown?.(key('ArrowLeft'))
    mocks.hotkey.onKeyDown?.(key('ArrowRight'))
    const calls = mocks.findAdjacent.mock.calls.map((c) => c[2])
    expect(calls).toEqual(['up', 'down', 'left', 'right'])
  })
})
