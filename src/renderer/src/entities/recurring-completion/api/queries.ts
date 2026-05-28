import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { RecurringCompletionItem } from '../model/types'

export const RECURRING_COMPLETION_KEY = 'recurring-completion'
const TODO_KEY = 'todo'
const HISTORY_KEY = 'history'

function deserializeCompletion(item: RecurringCompletionItem): RecurringCompletionItem {
  return {
    ...item,
    completedAt: new Date(item.completedAt),
    createdAt: new Date(item.createdAt)
  }
}

export function useRecurringCompletionsToday(
  workspaceId: string | null | undefined,
  date: Date
): UseQueryResult<RecurringCompletionItem[]> {
  const dateStr = date.toISOString().slice(0, 10)
  return useQuery({
    queryKey: [RECURRING_COMPLETION_KEY, 'today', workspaceId, dateStr],
    queryFn: async (): Promise<RecurringCompletionItem[]> => {
      const res: IpcResponse<RecurringCompletionItem[]> =
        await window.api.recurringCompletion.findTodayByWorkspace(workspaceId!, date)
      if (!res.success) throwIpcError(res)
      return (res.data ?? []).map(deserializeCompletion)
    },
    enabled: !!workspaceId
  })
}

export function useCompleteRecurring(): UseMutationResult<
  RecurringCompletionItem,
  Error,
  { workspaceId: string; ruleId: string; date: Date }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ruleId, date }) => {
      const res: IpcResponse<RecurringCompletionItem> =
        await window.api.recurringCompletion.complete(ruleId, date)
      if (!res.success) throwIpcError(res)
      return deserializeCompletion(res.data!)
    },
    onSuccess: (_, { workspaceId, date }) => {
      const dateStr = date.toISOString().slice(0, 10)
      queryClient.invalidateQueries({
        queryKey: [RECURRING_COMPLETION_KEY, 'today', workspaceId, dateStr]
      })
      queryClient.invalidateQueries({
        queryKey: [TODO_KEY, 'completedWithRecurring', workspaceId]
      })
      queryClient.invalidateQueries({
        queryKey: [TODO_KEY, workspaceId]
      })
      // 반복 완료도 히스토리에 반영
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY, workspaceId] })
    }
  })
}

