import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** MainLayout에서 호출 — canvas:changed push 이벤트 구독 + React Query invalidation */
export function useCanvasWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.canvas.onChanged((workspaceId: string) => {
      queryClient.invalidateQueries({ queryKey: ['canvas', 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['canvas', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['canvasNode'] })
      queryClient.invalidateQueries({ queryKey: ['canvasEdge'] })
    })
    return () => unsub()
  }, [queryClient])
}
