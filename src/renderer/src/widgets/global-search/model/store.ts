import { create } from 'zustand'

interface GlobalSearchStore {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

/** 전체 검색 다이얼로그 open 상태 — 전역 단축키/사이드바 어디서든 토글. */
export const useGlobalSearchStore = create<GlobalSearchStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open }))
}))
