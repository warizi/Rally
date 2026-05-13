import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * MainLayout에서 호출 — recurring-rule:changed + recurring-completion:changed push 이벤트 구독.
 * 두 채널 모두 RECURRING_RULE_KEY 및 RECURRING_COMPLETION_KEY 와 히스토리/완료 통합 목록을 invalidate.
 */
export function useRecurringRuleWatcher(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const invalidate = (workspaceId: string): void => {
      queryClient.invalidateQueries({ queryKey: ['recurring-rule', 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['recurring-rule', 'today', workspaceId] })
      queryClient.invalidateQueries({
        queryKey: ['recurring-completion', 'today', workspaceId]
      })
      // 완료 + 반복 통합 목록 (useCompletedWithRecurring) — 키: ['todo', workspaceId]
      queryClient.invalidateQueries({ queryKey: ['todo', workspaceId] })
      // 히스토리 (완료 기반)
      queryClient.invalidateQueries({ queryKey: ['history', workspaceId] })
    }
    const unsubRule = window.api.recurringRule.onChanged(invalidate)
    const unsubCompletion = window.api.recurringCompletion.onChanged(invalidate)
    return () => {
      unsubRule()
      unsubCompletion()
    }
  }, [queryClient])
}
