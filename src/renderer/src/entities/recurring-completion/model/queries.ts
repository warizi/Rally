import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import { RECURRING_RULE_KEY } from '@entities/recurring-rule'
import type { RecurringCompletionItem, CompletedItem } from './types'

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

export function useCompletedWithRecurring(
  workspaceId: string | null | undefined
): UseQueryResult<CompletedItem[]> {
  return useQuery({
    queryKey: [TODO_KEY, workspaceId],
    queryFn: async (): Promise<CompletedItem[]> => {
      const res = await window.api.todo.findCompletedWithRecurring(workspaceId!)
      if (!res.success) throwIpcError(res)
      return (res.data ?? []).map((item) => {
        if (item.type === 'todo') {
          return {
            type: 'todo' as const,
            completedAt: new Date(item.completedAt),
            todo: {
              ...item.todo!,
              createdAt: new Date(item.todo!.createdAt),
              updatedAt: new Date(item.todo!.updatedAt),
              doneAt: item.todo!.doneAt ? new Date(item.todo!.doneAt) : null,
              dueDate: item.todo!.dueDate ? new Date(item.todo!.dueDate) : null,
              startDate: item.todo!.startDate ? new Date(item.todo!.startDate) : null
            }
          }
        }
        return {
          type: 'recurring' as const,
          completedAt: new Date(item.completedAt),
          recurringCompletion: deserializeCompletion(item.recurringCompletion!)
        }
      })
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

export function useUncompleteRecurring(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; completionId: string; date: Date }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ completionId }) => {
      const res: IpcResponse<void> = await window.api.recurringCompletion.uncomplete(completionId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId, date }) => {
      const dateStr = date.toISOString().slice(0, 10)
      queryClient.invalidateQueries({
        queryKey: [RECURRING_COMPLETION_KEY, 'today', workspaceId, dateStr]
      })
      queryClient.invalidateQueries({
        queryKey: [TODO_KEY, 'completedWithRecurring', workspaceId]
      })
      // 반복 규칙의 today 캐시도 갱신 (완료 해제 시 섹션 상태 반영)
      queryClient.invalidateQueries({
        queryKey: [RECURRING_RULE_KEY, 'today', workspaceId]
      })
      queryClient.invalidateQueries({
        queryKey: [TODO_KEY, workspaceId]
      })
      // 반복 완료 해제도 히스토리에 반영
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY, workspaceId] })
    }
  })
}
