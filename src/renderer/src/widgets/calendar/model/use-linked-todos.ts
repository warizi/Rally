import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { TodoItem } from '@entities/todo'

const SCHEDULE_KEY = 'schedule'

export function useLinkedTodos(scheduleId: string | undefined): UseQueryResult<TodoItem[]> {
  return useQuery({
    queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId],
    queryFn: async (): Promise<TodoItem[]> => {
      const res: IpcResponse<TodoItem[]> = await window.api.schedule.getLinkedTodos(scheduleId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!scheduleId
  })
}

export function useLinkTodo(): UseMutationResult<
  void,
  Error,
  { scheduleId: string; todoId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, todoId }) => {
      const res = await window.api.schedule.linkTodo(scheduleId, todoId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId]
      })
    }
  })
}

export function useUnlinkTodo(): UseMutationResult<
  void,
  Error,
  { scheduleId: string; todoId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, todoId }) => {
      const res = await window.api.schedule.unlinkTodo(scheduleId, todoId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId]
      })
    }
  })
}
