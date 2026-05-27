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
  clearMode: () => void
}

type KeyboardModeStore = KeyboardModeState & KeyboardModeActions

export const useKeyboardModeStore = create<KeyboardModeStore>()((set) => ({
  mode: null,
  setMode: (mode) => set({ mode }),
  clearMode: () => set({ mode: null })
}))
