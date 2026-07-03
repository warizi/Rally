/**
 * OS별 단축키 modifier/라벨 helper.
 *
 * mac은 Cmd(meta), Windows/Linux는 Ctrl을 primary modifier로 쓴다 — Windows에서
 * metaKey는 Win키라 OS가 가로채 전역 단축키로 쓸 수 없다.
 * FSD 역방향(import widgets) 방지를 위해 구조적 타입만 반환한다.
 */
import { isMac } from './platform'

/** 전역 hotkey spec용 primary modifier — 호출부에서 spread해 사용 */
export function primaryModifierSpec(): { meta?: boolean; ctrl?: boolean } {
  return isMac() ? { meta: true } : { ctrl: true }
}

/** ReactFlow selectionKeyCode — mac은 Meta(Cmd)+drag, 그 외 Control+drag */
export function primarySelectionKeyCode(): 'Meta' | 'Control' {
  return isMac() ? 'Meta' : 'Control'
}

export function primaryModifierLabel(): '⌘' | 'Ctrl' {
  return isMac() ? '⌘' : 'Ctrl'
}

export function altModifierLabel(): '⌥' | 'Alt' {
  return isMac() ? '⌥' : 'Alt'
}

export function shiftModifierLabel(): '⇧' | 'Shift' {
  return isMac() ? '⇧' : 'Shift'
}

/** 사람이 읽는 조합 문자열 — mac '⌘⇧F', 그 외 'Ctrl+Shift+F' */
export function comboLabel(...keys: string[]): string {
  return isMac() ? keys.join('') : keys.join('+')
}
