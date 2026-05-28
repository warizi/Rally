/**
 * 키보드 조작 모드 store (Zustand).
 *
 * 한 번에 한 가지 모드만 활성 — pane-nav / tab-nav / snapshot-nav.
 * 각 기능별 hotkey hook 이 setMode/clearMode 를 호출하고, 오버레이 UI 는
 * mode 를 구독해서 표시 여부를 결정.
 */
import { create } from 'zustand'
import type { KeyboardMode } from './types'

interface KeyboardModeState {
  mode: KeyboardMode
}

interface KeyboardModeActions {
  setMode: (mode: Exclude<KeyboardMode, null>) => void
  /**
   * 자기 모드만 해제 — 인자로 자기 mode 를 전달. 현재 활성 모드와 일치할 때만
   * null 로 reset. 다른 hook 이 자기 deactivate 시점에 호출해도 다른 모드를
   * 덮어쓰지 않게 한다 (modifier 순서가 엇갈리면 발생하던 race).
   */
  clearMode: (mode: Exclude<KeyboardMode, null>) => void
}

type KeyboardModeStore = KeyboardModeState & KeyboardModeActions

export const useKeyboardModeStore = create<KeyboardModeStore>()((set, get) => ({
  mode: null,
  setMode: (mode) => set({ mode }),
  clearMode: (mode) => {
    if (get().mode === mode) set({ mode: null })
  }
}))
