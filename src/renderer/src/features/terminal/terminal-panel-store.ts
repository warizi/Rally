import { create } from 'zustand'

interface TerminalPanelState {
  isOpen: boolean
  hasBeenOpened: boolean
  toggle: () => void
  open: () => void
  close: () => void
  reset: () => void
}

export const useTerminalPanelStore = create<TerminalPanelState>((set) => ({
  isOpen: false,
  hasBeenOpened: false,
  toggle: () =>
    set((s) => ({
      isOpen: !s.isOpen,
      hasBeenOpened: s.hasBeenOpened || !s.isOpen
    })),
  open: () => set({ isOpen: true, hasBeenOpened: true }),
  close: () => set({ isOpen: false }),
  reset: () => set({ isOpen: false, hasBeenOpened: false })
}))
