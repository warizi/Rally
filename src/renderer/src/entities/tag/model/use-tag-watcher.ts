import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — tag:changed push 이벤트 구독 + React Query invalidation */
export function useTagWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.tag.onChanged((workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['tag', workspaceId] })
      // itemTag 매핑 전반 invalidate (item별 / tag별 모두)
      queryClient.invalidateQueries({ queryKey: ['itemTag'] })
    })
    return () => unsub()
  }, [queryClient])
}
