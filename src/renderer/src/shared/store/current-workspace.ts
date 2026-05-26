import { create } from 'zustand'

interface CurrentWorkspaceStore {
  currentWorkspaceId: string | null
  isInitialized: boolean
  initialize: (id: string | null) => void
  setCurrentWorkspaceId: (id: string) => void
  // main process(=MCP manage_workspace switch) 에서 활성 워크스페이스를 바꾼
  // 경우, renderer 가 watcher.activate 를 다시 호출할 필요 없이 store / settings 만 동기화.
  syncCurrentWorkspaceIdFromMain: (id: string) => void
  clearCurrentWorkspaceId: () => void
}

export const useCurrentWorkspaceStore = create<CurrentWorkspaceStore>()((set, get) => ({
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
  syncCurrentWorkspaceIdFromMain: (id: string): void => {
    if (get().currentWorkspaceId === id) return
    set({ currentWorkspaceId: id })
    window.api.settings.set('currentWorkspaceId', id).catch(console.error)
  },
  clearCurrentWorkspaceId: (): void => {
    set({ currentWorkspaceId: null })
    window.api.settings.set('currentWorkspaceId', '').catch(console.error)
  }
}))
