import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useWorkspaces } from '@entities/workspace'

type Workspace = Exclude<ReturnType<typeof useWorkspaces>['data'], undefined>[number]

export function useWorkspaceSwitch(): {
  workspaces: ReturnType<typeof useWorkspaces>['data']
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | undefined
  handleSwitch: (id: string) => void
  handleCreated: (id: string) => void
  handleDeleted: () => void
  isLastWorkspace: boolean
} {
  const { data: workspaces = [] } = useWorkspaces()
  const currentWorkspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const setCurrentWorkspaceId = useCurrentWorkspaceStore((s) => s.setCurrentWorkspaceId)
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)

  const handleSwitch = (id: string): void => {
    setCurrentWorkspaceId(id)
  }

  const handleCreated = (id: string): void => {
    handleSwitch(id)
  }

  const handleDeleted = (): void => {
    const remaining = workspaces.filter((w) => w.id !== currentWorkspaceId)
    if (remaining.length > 0) {
      handleSwitch(remaining[0].id)
    }
  }

  const isLastWorkspace = workspaces.length <= 1

  return {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    handleSwitch,
    handleCreated,
    handleDeleted,
    isLastWorkspace
  }
}
