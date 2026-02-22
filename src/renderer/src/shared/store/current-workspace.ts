import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CurrentWorkspaceStore {
  currentWorkspaceId: string | null
  setCurrentWorkspaceId: (id: string) => void
  clearCurrentWorkspaceId: () => void
}

export const useCurrentWorkspaceStore = create<CurrentWorkspaceStore>()(
  persist(
    (set): CurrentWorkspaceStore => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id: string): void => {
        set({ currentWorkspaceId: id })
      },
      clearCurrentWorkspaceId: (): void => {
        set({ currentWorkspaceId: null })
      },
    }),
    {
      name: 'current-workspace',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
