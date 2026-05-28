import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTabStore } from '../store'
import { useFocusModeEffects } from '../use-focus-mode-effects'
import { selectFocusedTabId } from '../selectors'

beforeEach(() => {
  useTabStore.getState().reset()
})

describe('enterFocusMode / exitFocusMode (스택)', () => {
  it('초기 상태에서 focusedTabIds 는 빈 배열이다', () => {
    expect(useTabStore.getState().focusedTabIds).toEqual([])
    expect(selectFocusedTabId(useTabStore.getState())).toBeNull()
  })

  it('존재하는 탭을 enterFocusMode 하면 스택 top 으로 push 된다', () => {
    const tabId = useTabStore.getState().openTab({ type: 'todo', pathname: '/todo', title: '할일' })

    useTabStore.getState().enterFocusMode(tabId)
    expect(useTabStore.getState().focusedTabIds).toEqual([tabId])
    expect(selectFocusedTabId(useTabStore.getState())).toBe(tabId)
  })

  it('존재하지 않는 탭은 push 되지 않는다', () => {
    useTabStore.getState().enterFocusMode('tab-nonexistent')
    expect(useTabStore.getState().focusedTabIds).toEqual([])
  })

  it('이미 스택에 있는 탭을 다시 enterFocusMode 하면 기존 자리에서 제거 후 top 으로 재배치된다', () => {
    const a = useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    const b = useTabStore.getState().openTab({ type: 'note', pathname: '/b', title: 'B' })

    useTabStore.getState().enterFocusMode(a)
    useTabStore.getState().enterFocusMode(b)
    expect(useTabStore.getState().focusedTabIds).toEqual([a, b])

    useTabStore.getState().enterFocusMode(a)
    expect(useTabStore.getState().focusedTabIds).toEqual([b, a])
  })

  it('exitFocusMode 는 top 한 칸만 pop 한다', () => {
    const a = useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    const b = useTabStore.getState().openTab({ type: 'note', pathname: '/b', title: 'B' })
    useTabStore.getState().enterFocusMode(a)
    useTabStore.getState().enterFocusMode(b)

    useTabStore.getState().exitFocusMode()
    expect(useTabStore.getState().focusedTabIds).toEqual([a])

    useTabStore.getState().exitFocusMode()
    expect(useTabStore.getState().focusedTabIds).toEqual([])
  })

  it('exitFocusMode 는 스택이 비어있으면 무동작이다', () => {
    expect(() => useTabStore.getState().exitFocusMode()).not.toThrow()
    expect(useTabStore.getState().focusedTabIds).toEqual([])
  })

  it('reset 시 focusedTabIds 가 빈 배열로 초기화된다', () => {
    const tabId = useTabStore.getState().openTab({ type: 'todo', pathname: '/todo', title: '할일' })
    useTabStore.getState().enterFocusMode(tabId)

    useTabStore.getState().reset()
    expect(useTabStore.getState().focusedTabIds).toEqual([])
  })
})

describe('focus 모드 중 openTab — 스택 push', () => {
  it('focus 모드 중 새 탭을 열면 스택 top 으로 push 된다', () => {
    const a = useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    useTabStore.getState().enterFocusMode(a)

    const b = useTabStore.getState().openTab({ type: 'note', pathname: '/b', title: 'B' })

    expect(useTabStore.getState().focusedTabIds).toEqual([a, b])
    expect(selectFocusedTabId(useTabStore.getState())).toBe(b)
  })

  it('focus 모드 중 이미 열린 pathname 을 다시 열면 스택에 재배치(중복 방지)된다', () => {
    const a = useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    const b = useTabStore.getState().openTab({ type: 'note', pathname: '/b', title: 'B' })
    useTabStore.getState().enterFocusMode(a)
    useTabStore.getState().enterFocusMode(b)

    // a 를 다시 openTab → 스택은 [b, a]
    useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    expect(useTabStore.getState().focusedTabIds).toEqual([b, a])
  })

  it('focus 모드가 아닐 때 openTab 은 스택에 영향 없다', () => {
    expect(useTabStore.getState().focusedTabIds).toEqual([])
    useTabStore.getState().openTab({ type: 'todo', pathname: '/x', title: 'X' })
    expect(useTabStore.getState().focusedTabIds).toEqual([])
  })

  it('focus 모드 중 openRightTab 으로 기존 탭을 활성화하면 스택 top 으로 push 된다', () => {
    const folder = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder', title: '탐색기' })
    const note = useTabStore
      .getState()
      .openTab({ type: 'note', pathname: '/note/a', title: '노트A' })
    useTabStore.getState().enterFocusMode(folder)
    // openRightTab 은 sourcePaneId 가 필요. 기본 패인을 사용.
    const sourcePaneId = useTabStore.getState().activePaneId

    useTabStore
      .getState()
      .openRightTab({ type: 'note', pathname: '/note/a', title: '노트A' }, sourcePaneId)

    expect(useTabStore.getState().focusedTabIds).toEqual([folder, note])
  })

  it('focus 모드 중 activateTab 으로 다른 탭을 활성화하면 스택 top 으로 push 된다', () => {
    const folder = useTabStore
      .getState()
      .openTab({ type: 'folder', pathname: '/folder', title: '탐색기' })
    const note = useTabStore
      .getState()
      .openTab({ type: 'note', pathname: '/note/a', title: '노트A' })
    useTabStore.getState().enterFocusMode(folder)

    useTabStore.getState().activateTab(note)

    expect(useTabStore.getState().focusedTabIds).toEqual([folder, note])
  })
})

describe('useFocusModeEffects', () => {
  it('스택의 탭이 닫히면 자동으로 스택에서 제거된다', () => {
    const a = useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    const b = useTabStore.getState().openTab({ type: 'note', pathname: '/b', title: 'B' })
    useTabStore.getState().enterFocusMode(a)
    useTabStore.getState().enterFocusMode(b)

    const { rerender } = renderHook(() => useFocusModeEffects())

    act(() => {
      useTabStore.getState().closeTab(b)
    })
    rerender()
    expect(useTabStore.getState().focusedTabIds).toEqual([a])

    act(() => {
      useTabStore.getState().closeTab(a)
    })
    rerender()
    expect(useTabStore.getState().focusedTabIds).toEqual([])
  })

  it('ESC keydown 은 스택 top 만 pop 한다', () => {
    const a = useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    const b = useTabStore.getState().openTab({ type: 'note', pathname: '/b', title: 'B' })
    useTabStore.getState().enterFocusMode(a)
    useTabStore.getState().enterFocusMode(b)

    renderHook(() => useFocusModeEffects())

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(useTabStore.getState().focusedTabIds).toEqual([a])

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(useTabStore.getState().focusedTabIds).toEqual([])
  })

  it('스택이 비어있을 때 ESC 는 무시된다', () => {
    renderHook(() => useFocusModeEffects())

    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    }).not.toThrow()
    expect(useTabStore.getState().focusedTabIds).toEqual([])
  })
})
