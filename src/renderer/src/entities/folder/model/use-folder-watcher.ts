import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — push 이벤트 구독 + React Query invalidation */
export function useFolderWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.folder.onChanged((workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['folder', 'tree', workspaceId] })
    })
    return unsub
  }, [queryClient])
}
