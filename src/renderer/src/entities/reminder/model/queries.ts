import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { ReminderItem, SetReminderData } from './types'

const REMINDER_KEY = 'reminder'

export function useReminders(
  entityType: 'todo' | 'schedule' | null,
  entityId: string | null | undefined
): UseQueryResult<ReminderItem[]> {
  return useQuery({
    queryKey: [REMINDER_KEY, entityType, entityId],
    queryFn: async (): Promise<ReminderItem[]> => {
      const res: IpcResponse<ReminderItem[]> = await window.api.reminder.findByEntity(
        entityType!,
        entityId!
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!entityType && !!entityId
  })
}

export function useSetReminder(): UseMutationResult<
  ReminderItem | undefined,
  Error,
  SetReminderData
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: SetReminderData) => {
      const res: IpcResponse<ReminderItem> = await window.api.reminder.set(data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({
        queryKey: [REMINDER_KEY, data.entityType, data.entityId]
      })
    }
  })
}

export function useRemoveReminder(): UseMutationResult<
  void,
  Error,
  { reminderId: string; entityType: string; entityId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ reminderId }) => {
      const res: IpcResponse<void> = await window.api.reminder.remove(reminderId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { entityType, entityId }) => {
      queryClient.invalidateQueries({
        queryKey: [REMINDER_KEY, entityType, entityId]
      })
    }
  })
}
