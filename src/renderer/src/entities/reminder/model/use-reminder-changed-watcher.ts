import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * MainLayout에서 호출 — reminder:changed (CRUD) push 이벤트 구독 + React Query invalidation.
 * 별개로 reminder:fired (실행 시점) 채널은 features/reminder/useReminderWatcher 에서 토스트 트리거.
 */
export function useReminderChangedWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const unsub = window.api.reminder.onChanged(() => {
      // reminder 쿼리는 entityType+entityId 단위 — 어떤 엔티티가 영향받았는지 broadcast 페이로드만으로는
      // 알 수 없으므로 reminder 도메인 전체 invalidate.
      queryClient.invalidateQueries({ queryKey: ['reminder'] })
    })
    return () => unsub()
  }, [queryClient])
}
