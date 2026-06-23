/**
 * useGlobalHotkey hook 단위 테스트.
 *
 * happy-dom 환경에서 KeyboardEvent dispatch 로 시뮬레이션.
 * macOS 매핑 — meta = Cmd, ctrl = Control.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGlobalHotkey } from '../use-global-hotkey'

function fireKeyDown(opts: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}): void {
  const e = new KeyboardEvent('keydown', { ...opts, bubbles: true })
  window.dispatchEvent(e)
}

function fireKeyUp(opts: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}): void {
  const e = new KeyboardEvent('keyup', { ...opts, bubbles: true })
  window.dispatchEvent(e)
}

describe('useGlobalHotkey', () => {
  beforeEach(() => {
    // body focus 보장 — isEditableFocused() false.
    document.body.focus()
  })

  afterEach(() => {
    // 입력 잔재 제거.
    document.body.innerHTML = ''
  })

  it('shift 만 keydown 시 onActivate 1회 + onKeyDown 호출', () => {
    const onActivate = vi.fn()
    const onKeyDown = vi.fn()
    renderHook(() =>
      useGlobalHotkey({
        modifiers: { shift: true },
        onActivate,
        onKeyDown
      })
    )

    act(() => fireKeyDown({ key: 'Shift', shiftKey: true }))
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })

  it('활성 상태에서 추가 key (Tab) keydown 마다 onKeyDown 누적 호출', () => {
    const onActivate = vi.fn()
    const onKeyDown = vi.fn()
    renderHook(() => useGlobalHotkey({ modifiers: { shift: true }, onActivate, onKeyDown }))

    act(() => {
      fireKeyDown({ key: 'Shift', shiftKey: true })
      fireKeyDown({ key: 'Tab', shiftKey: true })
      fireKeyDown({ key: 'Tab', shiftKey: true })
    })
    expect(onActivate).toHaveBeenCalledTimes(1)
    // Shift keydown 1 + Tab keydown 2
    expect(onKeyDown).toHaveBeenCalledTimes(3)
  })

  it('소비자가 preventDefault 안 한 키 → stopPropagation 호출 안 함 (다른 단축키 통과)', () => {
    renderHook(() =>
      useGlobalHotkey({ modifiers: { meta: true, shift: true }, onKeyDown: () => {} })
    )
    const e = new KeyboardEvent('keydown', {
      key: 'z',
      code: 'KeyZ',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    })
    const stopSpy = vi.spyOn(e, 'stopPropagation')
    act(() => {
      window.dispatchEvent(e)
    })
    expect(stopSpy).not.toHaveBeenCalled()
  })

  it('소비자가 preventDefault 한 키 → stopPropagation 호출 (component listener 충돌 방지 유지)', () => {
    renderHook(() =>
      useGlobalHotkey({
        modifiers: { meta: true, shift: true },
        onKeyDown: (ev) => ev.preventDefault()
      })
    )
    const e = new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    })
    const stopSpy = vi.spyOn(e, 'stopPropagation')
    act(() => {
      window.dispatchEvent(e)
    })
    expect(stopSpy).toHaveBeenCalled()
  })

  it('shift 해제 시 onDeactivate 호출', () => {
    const onDeactivate = vi.fn()
    renderHook(() => useGlobalHotkey({ modifiers: { shift: true }, onDeactivate }))

    act(() => {
      fireKeyDown({ key: 'Shift', shiftKey: true })
      fireKeyUp({ key: 'Shift', shiftKey: false })
    })
    expect(onDeactivate).toHaveBeenCalledTimes(1)
  })

  it('modifier 가 spec 과 다르면 (예: ctrl 빠짐) activate 안 함', () => {
    const onActivate = vi.fn()
    renderHook(() =>
      useGlobalHotkey({
        modifiers: { ctrl: true, shift: true },
        onActivate
      })
    )

    act(() => fireKeyDown({ key: 'Shift', shiftKey: true }))
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('정확히 ctrl+shift 가 갖춰져야 activate', () => {
    const onActivate = vi.fn()
    renderHook(() =>
      useGlobalHotkey({
        modifiers: { ctrl: true, shift: true },
        onActivate
      })
    )

    act(() => fireKeyDown({ key: 'Shift', ctrlKey: true, shiftKey: true }))
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('스펙에 없는 modifier (cmd) 가 같이 눌리면 activate 안 함 (strict matching)', () => {
    const onActivate = vi.fn()
    renderHook(() => useGlobalHotkey({ modifiers: { shift: true }, onActivate }))

    act(() => fireKeyDown({ key: 'Shift', shiftKey: true, metaKey: true }))
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('input 에 포커스 있을 때는 activate 무시', () => {
    const onActivate = vi.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    renderHook(() => useGlobalHotkey({ modifiers: { shift: true }, onActivate }))
    act(() => fireKeyDown({ key: 'Shift', shiftKey: true }))
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('contenteditable 포커스 시도 무시', () => {
    const onActivate = vi.fn()
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.appendChild(div)
    div.focus()

    renderHook(() => useGlobalHotkey({ modifiers: { shift: true }, onActivate }))
    act(() => fireKeyDown({ key: 'Shift', shiftKey: true }))
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('enabled=false 시 리스너 미부착', () => {
    const onActivate = vi.fn()
    renderHook(() => useGlobalHotkey({ modifiers: { shift: true }, onActivate, enabled: false }))

    act(() => fireKeyDown({ key: 'Shift', shiftKey: true }))
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('window blur 시 활성 상태 강제 해제', () => {
    const onActivate = vi.fn()
    const onDeactivate = vi.fn()
    renderHook(() => useGlobalHotkey({ modifiers: { shift: true }, onActivate, onDeactivate }))

    act(() => {
      fireKeyDown({ key: 'Shift', shiftKey: true })
      window.dispatchEvent(new Event('blur'))
    })
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onDeactivate).toHaveBeenCalledTimes(1)
  })
})
