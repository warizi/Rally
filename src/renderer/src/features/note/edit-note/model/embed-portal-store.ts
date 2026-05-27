/**
 * 임베드 NodeView portal 등록 store.
 *
 * NodeView class 가 ProseMirror 안에 DOM element 를 만들 때 portal id (uuid)
 * 와 host element 를 store 에 등록. NoteEditor 의 `<EmbedPortals />` 컴포넌트가
 * store 를 구독해 각 등록된 host 마다 createPortal 로 EmbedView 를 render.
 *
 * 이렇게 하면 NodeView 안에서도 React Query / Context 가 정상 동작.
 */
import { create } from 'zustand'
import type { EmbedDomain } from './note-embed-schema'

export interface PortalEntry {
  portalId: string
  host: HTMLElement
  domain: EmbedDomain
  entityId: string
  height: number
}

interface PortalState {
  entries: Record<string, PortalEntry>
}

interface PortalActions {
  register: (entry: PortalEntry) => void
  unregister: (portalId: string) => void
  updateEntry: (portalId: string, patch: Partial<PortalEntry>) => void
}

export const useEmbedPortalStore = create<PortalState & PortalActions>()((set) => ({
  entries: {},
  register: (entry) =>
    set((s) => ({ entries: { ...s.entries, [entry.portalId]: entry } })),
  unregister: (portalId) =>
    set((s) => {
      const { [portalId]: _, ...rest } = s.entries
      return { entries: rest }
    }),
  updateEntry: (portalId, patch) =>
    set((s) => {
      const cur = s.entries[portalId]
      if (!cur) return s
      return { entries: { ...s.entries, [portalId]: { ...cur, ...patch } } }
    })
}))
