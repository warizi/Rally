import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { RecurringRuleItem, CreateRecurringRuleData, UpdateRecurringRuleData } from './types'

export const RECURRING_RULE_KEY = 'recurring-rule'

export function useRecurringRulesByWorkspace(
  workspaceId: string | null | undefined
): UseQueryResult<RecurringRuleItem[]> {
  return useQuery({
    queryKey: [RECURRING_RULE_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<RecurringRuleItem[]> => {
      const res: IpcResponse<RecurringRuleItem[]> = await window.api.recurringRule.findByWorkspace(
        workspaceId!
      )
      if (!res.success) throwIpcError(res)
      return (res.data ?? []).map(deserializeRule)
    },
    enabled: !!workspaceId
  })
}

export function useRecurringRulesToday(
  workspaceId: string | null | undefined,
  date: Date
): UseQueryResult<RecurringRuleItem[]> {
  const dateStr = date.toISOString().slice(0, 10)
  return useQuery({
    queryKey: [RECURRING_RULE_KEY, 'today', workspaceId, dateStr],
    queryFn: async (): Promise<RecurringRuleItem[]> => {
      const res: IpcResponse<RecurringRuleItem[]> = await window.api.recurringRule.findToday(
        workspaceId!,
        date
      )
      if (!res.success) throwIpcError(res)
      return (res.data ?? []).map(deserializeRule)
    },
    enabled: !!workspaceId
  })
}

export function useCreateRecurringRule(): UseMutationResult<
  RecurringRuleItem,
  Error,
  { workspaceId: string; data: CreateRecurringRuleData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, data }) => {
      const res: IpcResponse<RecurringRuleItem> = await window.api.recurringRule.create(
        workspaceId,
        data
      )
      if (!res.success) throwIpcError(res)
      return deserializeRule(res.data!)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_RULE_KEY, 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: [RECURRING_RULE_KEY, 'today', workspaceId] })
    }
  })
}

export function useUpdateRecurringRule(): UseMutationResult<
  RecurringRuleItem,
  Error,
  { workspaceId: string; ruleId: string; data: UpdateRecurringRuleData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ruleId, data }) => {
      const res: IpcResponse<RecurringRuleItem> = await window.api.recurringRule.update(
        ruleId,
        data
      )
      if (!res.success) throwIpcError(res)
      return deserializeRule(res.data!)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_RULE_KEY, 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: [RECURRING_RULE_KEY, 'today', workspaceId] })
    }
  })
}

export function useDeleteRecurringRule(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; ruleId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ruleId }) => {
      const res: IpcResponse<void> = await window.api.recurringRule.delete(ruleId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_RULE_KEY, 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: [RECURRING_RULE_KEY, 'today', workspaceId] })
    }
  })
}

function deserializeRule(rule: RecurringRuleItem): RecurringRuleItem {
  return {
    ...rule,
    startDate: new Date(rule.startDate),
    endDate: rule.endDate ? new Date(rule.endDate) : null,
    createdAt: new Date(rule.createdAt),
    updatedAt: new Date(rule.updatedAt)
  }
}
