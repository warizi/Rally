import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — schedule:changed push 이벤트 구독 + React Query invalidation */
export function useScheduleWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.schedule.onChanged((workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['schedule', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['schedule', 'linkedTodos'] })
    })
    return () => unsub()
  }, [queryClient])
}
