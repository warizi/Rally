/**
 * 키보드 조작 모드 — 글로벌 hotkey 시스템에서 동시에 한 가지 모드만 활성.
 *
 * - 'pane-nav'     : ctrl + shift (유지) + 방향키 → pane 간 active 이동
 * - 'tab-nav'      : shift (유지) + tab (클릭) → active pane 내 탭 nav
 * - 'snapshot-nav' : cmd + shift (유지) + t (클릭) → 탭 스냅샷 nav
 * - null           : 비활성
 */
export type KeyboardMode = 'pane-nav' | 'tab-nav' | 'snapshot-nav' | null

/** modifier 키 조합 spec — 모두 동시에 눌려있는 상태가 활성 조건. */
export interface HotkeyModifiers {
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}
