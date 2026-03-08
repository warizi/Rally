import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — todo:changed push 이벤트 구독 + React Query invalidation */
export function useTodoWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.todo.onChanged((workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['todo', 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['todo', 'dateRange', workspaceId] })
    })
    return () => unsub()
  }, [queryClient])
}
