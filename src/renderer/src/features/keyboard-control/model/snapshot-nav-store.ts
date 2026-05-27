/**
 * 탭 스냅샷 전환 오버레이 (cmd + shift + t) state store.
 *
 * useSnapshotNavigation hook 이 store 갱신, <SnapshotNavOverlay /> 가 구독.
 */
import { create } from 'zustand'

export interface SnapshotNavItem {
  snapshotId: string
  name: string
  description: string | null
}

interface SnapshotNavState {
  open: boolean
  items: SnapshotNavItem[]
  focusIndex: number
}

interface SnapshotNavActions {
  start: (items: SnapshotNavItem[], initialFocus: number) => void
  next: () => void
  close: () => void
}

type SnapshotNavStore = SnapshotNavState & SnapshotNavActions

export const useSnapshotNavStore = create<SnapshotNavStore>()((set) => ({
  open: false,
  items: [],
  focusIndex: 0,
  start: (items, initialFocus) => set({ open: true, items, focusIndex: initialFocus }),
  next: () =>
    set((s) => ({
      focusIndex: s.items.length === 0 ? 0 : (s.focusIndex + 1) % s.items.length
    })),
  close: () => set({ open: false, items: [], focusIndex: 0 })
}))
