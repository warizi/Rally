/**
 * 탭 이동 오버레이 (shift + tab) state store.
 *
 * useTabNavigation hook 이 store 갱신, <TabNavOverlay /> 가 store 구독.
 * 활성 pane 의 tab 목록 + 현재 focusIndex 추적.
 */
import { create } from 'zustand'

export interface TabNavItem {
  tabId: string
  title: string
  /** TabType — 아이콘 매핑용. */
  type: string
}

interface TabNavState {
  open: boolean
  items: TabNavItem[]
  focusIndex: number
}

interface TabNavActions {
  /** 첫 Tab keydown 시 호출 — items 캡처 + 초기 focusIndex 설정. */
  start: (items: TabNavItem[], initialFocus: number) => void
  /** 추가 Tab keydown 시 — focusIndex 순환. */
  next: () => void
  /** modifier 해제 시 — 오버레이 닫기. */
  close: () => void
}

type TabNavStore = TabNavState & TabNavActions

export const useTabNavStore = create<TabNavStore>()((set) => ({
  open: false,
  items: [],
  focusIndex: 0,
  start: (items, initialFocus) =>
    set({ open: true, items, focusIndex: initialFocus }),
  next: () =>
    set((s) => ({
      focusIndex: s.items.length === 0 ? 0 : (s.focusIndex + 1) % s.items.length
    })),
  close: () => set({ open: false, items: [], focusIndex: 0 })
}))
