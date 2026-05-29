/**
 * widgets/keyboard-control/model/use-tab-navigation.test.ts
 *
 * cmd+opt+]/[ 탭 이동 hook. useGlobalHotkey 를 모킹해 콜백을 캡처한 다음,
 * 가상 KeyboardEvent 로 next/prev 와 close (=activate target tab) 동작을 검증.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { hotkeyCapture } = vi.hoisted(() => ({
  hotkeyCapture: {
    onKeyDown: null as null | ((e: KeyboardEvent) => void),
    onDeactivate: null as null | (() => void)
  }
}))

vi.mock('../use-global-hotkey', () => ({
  useGlobalHotkey: (opts: {
    onKeyDown?: (e: KeyboardEvent) => void
    onDeactivate?: () => void
  }) => {
    hotkeyCapture.onKeyDown = opts.onKeyDown ?? null
    hotkeyCapture.onDeactivate = opts.onDeactivate ?? null
  }
}))

import { useTabStore } from '@/entities/tab-system'
import { useTabNavStore } from '../tab-nav-store'
import { useKeyboardModeStore } from '../keyboard-mode-store'
import { useTabNavigation } from '../use-tab-navigation'

function fakeKeydown(code: string): KeyboardEvent {
  const ev = { code, preventDefault: vi.fn() } as unknown as KeyboardEvent
  return ev
}

beforeEach(() => {
  useTabStore.getState().reset()
  useTabNavStore.getState().close()
  useKeyboardModeStore.setState({ mode: null })
  hotkeyCapture.onKeyDown = null
  hotkeyCapture.onDeactivate = null
})

describe('useTabNavigation — keydown 활성', () => {
  it('BracketRight (next) 첫 호출 → tab-nav 모드 진입 + focus 다음 tab', () => {
    const id1 = useTabStore.getState().openTab({ type: 'todo', pathname: '/x', title: 'X' })
    const id2 = useTabStore.getState().openTab({ type: 'todo', pathname: '/y', title: 'Y' })
    useTabStore.getState().activateTab(id1)

    renderHook(() => useTabNavigation())
    hotkeyCapture.onKeyDown?.(fakeKeydown('BracketRight'))

    const navState = useTabNavStore.getState()
    expect(navState.open).toBe(true)
    expect(useKeyboardModeStore.getState().mode).toBe('tab-nav')
    expect(navState.items.map((it) => it.tabId)).toContain(id1)
    expect(navState.items.map((it) => it.tabId)).toContain(id2)
    // dashboard 도 포함될 수 있으나, 첫 활성화 focus 가 currentIdx + 1
    const idsList = navState.items.map((it) => it.tabId)
    const currentIdx = idsList.indexOf(id1)
    expect(navState.focusIndex).toBe((currentIdx + 1) % idsList.length)
  })

  it('BracketLeft (prev) 첫 호출 → focus 이전 tab', () => {
    const id1 = useTabStore.getState().openTab({ type: 'todo', pathname: '/x', title: 'X' })
    useTabStore.getState().openTab({ type: 'todo', pathname: '/y', title: 'Y' })
    useTabStore.getState().activateTab(id1)

    renderHook(() => useTabNavigation())
    hotkeyCapture.onKeyDown?.(fakeKeydown('BracketLeft'))

    const navState = useTabNavStore.getState()
    expect(navState.open).toBe(true)
    const idsList = navState.items.map((it) => it.tabId)
    const currentIdx = idsList.indexOf(id1)
    const expected = (currentIdx - 1 + idsList.length) % idsList.length
    expect(navState.focusIndex).toBe(expected)
  })

  it('첫 호출에 items 가 0 개면 아무 동작 안 함', () => {
    // reset → main pane 에 dashboard 1 개 있어 0 개 시나리오를 인공으로 만들기 어려움.
    // 빈 pane 시나리오: activePaneId 를 존재하지 않는 값으로 설정.
    useTabStore.setState({ activePaneId: 'phantom' })

    renderHook(() => useTabNavigation())
    hotkeyCapture.onKeyDown?.(fakeKeydown('BracketRight'))
    expect(useTabNavStore.getState().open).toBe(false)
    expect(useKeyboardModeStore.getState().mode).toBe(null)
  })

  it('알 수 없는 code → 무시', () => {
    renderHook(() => useTabNavigation())
    hotkeyCapture.onKeyDown?.(fakeKeydown('KeyA'))
    expect(useTabNavStore.getState().open).toBe(false)
  })

  it('두번째 BracketRight → next() 호출 (focusIndex 증가)', () => {
    useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    useTabStore.getState().openTab({ type: 'todo', pathname: '/b', title: 'B' })

    renderHook(() => useTabNavigation())
    hotkeyCapture.onKeyDown?.(fakeKeydown('BracketRight'))
    const focus1 = useTabNavStore.getState().focusIndex
    hotkeyCapture.onKeyDown?.(fakeKeydown('BracketRight'))
    const focus2 = useTabNavStore.getState().focusIndex
    const len = useTabNavStore.getState().items.length
    expect(focus2).toBe((focus1 + 1) % len)
  })

  it('두번째 BracketLeft → prev() 호출', () => {
    useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    useTabStore.getState().openTab({ type: 'todo', pathname: '/b', title: 'B' })

    renderHook(() => useTabNavigation())
    hotkeyCapture.onKeyDown?.(fakeKeydown('BracketRight')) // 진입
    const focus1 = useTabNavStore.getState().focusIndex
    hotkeyCapture.onKeyDown?.(fakeKeydown('BracketLeft'))
    const focus2 = useTabNavStore.getState().focusIndex
    const len = useTabNavStore.getState().items.length
    expect(focus2).toBe((focus1 - 1 + len) % len)
  })
})

describe('useTabNavigation — onDeactivate', () => {
  it('활성 상태에서 deactivate → focus 탭 activate + 오버레이 close + 모드 clear', () => {
    const id1 = useTabStore.getState().openTab({ type: 'todo', pathname: '/a', title: 'A' })
    const id2 = useTabStore.getState().openTab({ type: 'todo', pathname: '/b', title: 'B' })
    useTabStore.getState().activateTab(id1)

    renderHook(() => useTabNavigation())
    hotkeyCapture.onKeyDown?.(fakeKeydown('BracketRight'))

    // focusIndex 가 id2 를 가리키도록 보장
    const idsList = useTabNavStore.getState().items.map((it) => it.tabId)
    const id2Idx = idsList.indexOf(id2)
    useTabNavStore.setState({ focusIndex: id2Idx })

    hotkeyCapture.onDeactivate?.()
    expect(useTabNavStore.getState().open).toBe(false)
    expect(useKeyboardModeStore.getState().mode).toBe(null)
    // 활성 탭이 id2 로 변경
    const activePaneId = useTabStore.getState().activePaneId
    expect(useTabStore.getState().panes[activePaneId].activeTabId).toBe(id2)
  })

  it('open=false 일 때 deactivate → close 만 호출 (no-op 같음)', () => {
    renderHook(() => useTabNavigation())
    // 진입 안 함 → open false
    hotkeyCapture.onDeactivate?.()
    expect(useTabNavStore.getState().open).toBe(false)
  })
})
