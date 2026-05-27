/**
 * 글로벌 hotkey hook — window keydown/keyup 에서 modifier 조합 유지/해제 감지.
 *
 * Lifecycle:
 * - onActivate    : `modifiers` 가 모두 처음 갖춰진 순간 (keydown)
 * - onKeyDown     : modifier 유지 중 임의 key 가 눌릴 때마다 (repeat 포함)
 * - onDeactivate  : 활성 상태에서 modifier 중 하나라도 해제될 때
 *
 * 입력 충돌 방지: <input>, <textarea>, [contenteditable] 에 포커스가
 * 있을 때는 비활성 — 기존 편집을 방해하지 않는다.
 *
 * macOS 전용 매핑: `meta` = Cmd, `ctrl` = Control.
 */
import { useEffect, useRef } from 'react'
import type { HotkeyModifiers } from './types'

export interface UseGlobalHotkeyOptions {
  /** 활성 조건 modifier 조합 (모두 동시에 눌려있어야 활성). */
  modifiers: HotkeyModifiers
  /** modifier 가 처음 모두 갖춰진 순간 1 회. */
  onActivate?: () => void
  /** 활성 상태에서 임의 key keydown. event.key 로 분기. */
  onKeyDown?: (event: KeyboardEvent) => void
  /** 활성 상태에서 modifier 하나라도 해제. */
  onDeactivate?: () => void
  /** false 면 hook 자체 비활성 (리스너 미부착). */
  enabled?: boolean
}

function isEditableFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  const html = el as HTMLElement
  if (html.isContentEditable) return true
  return false
}

/** event 의 modifier 상태가 spec 을 모두 충족하는지. spec 에 명시되지 않은 modifier 는 false 여야 한다. */
function matchesModifiers(event: KeyboardEvent, spec: HotkeyModifiers): boolean {
  return (
    event.metaKey === Boolean(spec.meta) &&
    event.ctrlKey === Boolean(spec.ctrl) &&
    event.shiftKey === Boolean(spec.shift) &&
    event.altKey === Boolean(spec.alt)
  )
}

export function useGlobalHotkey({
  modifiers,
  onActivate,
  onKeyDown,
  onDeactivate,
  enabled = true
}: UseGlobalHotkeyOptions): void {
  // 활성 상태 ref — render 사이클과 무관하게 즉시 반영.
  const activeRef = useRef(false)
  // 핸들러 ref — 매 render 마다 최신 함수 유지 (effect 재등록 없이).
  const handlersRef = useRef({ onActivate, onKeyDown, onDeactivate })
  handlersRef.current = { onActivate, onKeyDown, onDeactivate }

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableFocused()) {
        // 입력 중에는 활성화 중단.
        if (activeRef.current) {
          activeRef.current = false
          handlersRef.current.onDeactivate?.()
        }
        return
      }

      const matches = matchesModifiers(event, modifiers)
      if (matches) {
        if (!activeRef.current) {
          activeRef.current = true
          handlersRef.current.onActivate?.()
        }
        handlersRef.current.onKeyDown?.(event)
        // 매칭된 이벤트는 다른 component-level listener (예: PanelResizeHandle 의
        // shift+arrow keyboard resize) 까지 전파되지 않도록 capture 단계에서 차단.
        event.stopPropagation()
      } else if (activeRef.current) {
        // 활성 중 modifier 가 어긋난 keydown (e.g., 다른 키 조합) — 해제 처리.
        activeRef.current = false
        handlersRef.current.onDeactivate?.()
      }
    }

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (!activeRef.current) return
      // 활성 상태에서 modifier 중 하나가 release 된 경우 deactivate.
      if (!matchesModifiers(event, modifiers)) {
        activeRef.current = false
        handlersRef.current.onDeactivate?.()
      }
    }

    const handleBlur = (): void => {
      // 윈도우 포커스 잃으면 강제 해제 — sticky modifier 상태 잔재 방지.
      if (activeRef.current) {
        activeRef.current = false
        handlersRef.current.onDeactivate?.()
      }
    }

    // capture phase 등록 — window 단계에서 가장 먼저 잡아서 우리 hotkey 가
    // component-level listener (e.g. react-resizable-panels 의 PanelResizeHandle
    // shift+arrow keyboard resize) 보다 우선권을 갖도록.
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleBlur)
    }
  }, [enabled, modifiers.meta, modifiers.ctrl, modifiers.shift, modifiers.alt])
}
