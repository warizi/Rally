import { create } from 'zustand'
import type { TerminalSession, TerminalLayoutNode } from './types'

interface TerminalStoreState {
  sessions: Record<string, TerminalSession>
  activeSessionId: string | null
  layout: TerminalLayoutNode | null

  addSession: (session: TerminalSession) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string) => void
  setLayout: (layout: TerminalLayoutNode) => void
  updateSession: (id: string, patch: Partial<TerminalSession>) => void
  reset: () => void
}

const initialState = {
  sessions: {},
  activeSessionId: null,
  layout: null
}

export const useTerminalStore = create<TerminalStoreState>((set) => ({
  ...initialState,

  addSession: (session) =>
    set((s) => ({
      sessions: { ...s.sessions, [session.id]: session },
      activeSessionId: s.activeSessionId ?? session.id,
      layout: s.layout ?? { type: 'leaf', sessionId: session.id }
    })),

  removeSession: (id) =>
    set((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _, ...rest } = s.sessions
      const ids = Object.keys(rest)
      return {
        sessions: rest,
        activeSessionId:
          s.activeSessionId === id ? (ids[ids.length - 1] ?? null) : s.activeSessionId
      }
    }),

  setActiveSession: (id) => set({ activeSessionId: id }),

  setLayout: (layout) => set({ layout }),

  updateSession: (id, patch) =>
    set((s) => ({
      sessions: {
        ...s.sessions,
        [id]: { ...s.sessions[id], ...patch }
      }
    })),

  reset: () => set(initialState)
}))
