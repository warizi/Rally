import { useEffect } from 'react'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import type { TabType } from '@shared/constants/tab-url'

/** MainLayout에서 호출 — reminder:fired push 이벤트 구독 + 탭 열기 */
export function useReminderWatcher(): void {
  const openTab = useTabStore((s) => s.openTab)

  useEffect(() => {
    const unsub = window.api.reminder.onFired(
      (data: { entityType: string; entityId: string; title: string }) => {
        const map: Record<string, { type: TabType; pathname: string } | null> = {
          todo: { type: 'todo-detail', pathname: `/todo/${data.entityId}` },
          schedule: null // schedule은 별도 탭이 없으므로 캘린더 탭 열기
        }

        const opts = map[data.entityType]
        if (opts) {
          openTab({ ...opts, title: data.title })
        } else if (data.entityType === 'schedule') {
          openTab({ type: 'calendar', pathname: '/calendar', title: '캘린더' })
        }
      }
    )
    return unsub
  }, [openTab])
}
