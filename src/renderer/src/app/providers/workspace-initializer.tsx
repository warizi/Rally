import { useEffect } from 'react'
import { useWorkspaces } from '@entities/workspace'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'

export function WorkspaceInitializer(): null {
  const { data: workspaces = [] } = useWorkspaces()
  const currentWorkspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const setCurrentWorkspaceId = useCurrentWorkspaceStore((s) => s.setCurrentWorkspaceId)

  useEffect(() => {
    if (workspaces.length === 0) return
    const isValid = workspaces.some((w) => w.id === currentWorkspaceId)
    if (!isValid) {
      setCurrentWorkspaceId(workspaces[0].id)
    }
  }, [workspaces, currentWorkspaceId, setCurrentWorkspaceId])

  return null
}
