import { create } from 'zustand'

interface CurrentWorkspaceStore {
  currentWorkspaceId: string | null
  isInitialized: boolean
  initialize: (id: string | null) => void
  setCurrentWorkspaceId: (id: string) => void
  clearCurrentWorkspaceId: () => void
}

export const useCurrentWorkspaceStore = create<CurrentWorkspaceStore>()((set) => ({
  currentWorkspaceId: null,
  isInitialized: false,
  initialize: (id: string | null): void => {
    set({ currentWorkspaceId: id, isInitialized: true })
  },
  setCurrentWorkspaceId: (id: string): void => {
    set({ currentWorkspaceId: id })
    window.api.settings.set('currentWorkspaceId', id).catch(console.error)
    window.api.workspace.activate(id).catch(console.error)
  },
  clearCurrentWorkspaceId: (): void => {
    set({ currentWorkspaceId: null })
    window.api.settings.set('currentWorkspaceId', '').catch(console.error)
  }
}))
