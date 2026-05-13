import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — template:changed push 이벤트 구독 + React Query invalidation */
export function useTemplateWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.template.onChanged((workspaceId: string) => {
      // note / csv 두 타입 모두 invalidate (workspaceId 필터링은 React Query가 처리)
      queryClient.invalidateQueries({ queryKey: ['template', 'list', workspaceId] })
    })
    return () => unsub()
  }, [queryClient])
}
