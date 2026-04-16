import { create } from 'zustand'

interface TerminalPanelState {
  isOpen: boolean
  hasBeenOpened: boolean
  panelSize: number // ResizablePanel size (%), 기본 30
  toggle: () => void
  open: () => void
  close: () => void
  setPanelSize: (size: number) => void
  reset: () => void
}

export const useTerminalPanelStore = create<TerminalPanelState>((set) => ({
  isOpen: false,
  hasBeenOpened: false,
  panelSize: 30,
  toggle: () =>
    set((s) => ({
      isOpen: !s.isOpen,
      hasBeenOpened: s.hasBeenOpened || !s.isOpen
    })),
  open: () => set({ isOpen: true, hasBeenOpened: true }),
  close: () => set({ isOpen: false }),
  setPanelSize: (size) => set({ panelSize: size }),
  reset: () => set({ isOpen: false, hasBeenOpened: false, panelSize: 30 })
}))
