import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { WelcomeModal } from './WelcomeModal'

export function WelcomeModalContainer(): React.JSX.Element {
  const setCurrentWorkspaceId = useCurrentWorkspaceStore((s) => s.setCurrentWorkspaceId)
  const queryClient = useQueryClient()

  const handleCreateSample = useCallback(async (): Promise<void> => {
    const res = await window.api.onboarding.createSampleWorkspace()
    if (!res.success || !res.data) {
      toast.error(res.message ?? '샘플 워크스페이스를 만들 수 없어요')
      throw new Error(res.message ?? 'createSampleWorkspace failed')
    }
    queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    setCurrentWorkspaceId(res.data.workspaceId)
    toast.success('샘플 워크스페이스가 준비됐어요')
  }, [queryClient, setCurrentWorkspaceId])

  return <WelcomeModal onCreateSample={handleCreateSample} />
}
