import { useEffect } from 'react'
import { useWorkspaces } from '@entities/workspace'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'

export function WorkspaceInitializer(): null {
  const { data: workspaces = [] } = useWorkspaces()
  const currentWorkspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const isInitialized = useCurrentWorkspaceStore((s) => s.isInitialized)
  const initialize = useCurrentWorkspaceStore((s) => s.initialize)
  const setCurrentWorkspaceId = useCurrentWorkspaceStore((s) => s.setCurrentWorkspaceId)

  // Step 1: DB에서 저장된 워크스페이스 ID 로드
  useEffect(() => {
    window.api.settings.get('currentWorkspaceId').then((res) => {
      initialize(res.data ?? null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Step 2: 로드 완료 후 유효성 검사 + main process에 활성 워크스페이스 알림
  useEffect(() => {
    if (!isInitialized || workspaces.length === 0) return
    const isValid = workspaces.some((w) => w.id === currentWorkspaceId)
    if (!isValid) {
      setCurrentWorkspaceId(workspaces[0].id)
    }
    const activeId = isValid ? currentWorkspaceId! : workspaces[0].id
    window.api.workspace.activate(activeId).catch(console.error)
  }, [workspaces, currentWorkspaceId, isInitialized, setCurrentWorkspaceId])

  return null
}
