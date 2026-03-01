import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type {
  ScheduleItem,
  CreateScheduleData,
  UpdateScheduleData,
  ScheduleDateRange,
} from './types'
import type { TodoItem } from '@entities/todo/model/types'

const SCHEDULE_KEY = 'schedule'

// --- Queries ---

export function useAllSchedulesByWorkspace(
  workspaceId: string | null | undefined
): UseQueryResult<ScheduleItem[]> {
  return useQuery({
    queryKey: [SCHEDULE_KEY, 'workspace', workspaceId, 'all'],
    queryFn: async (): Promise<ScheduleItem[]> => {
      const res: IpcResponse<ScheduleItem[]> =
        await window.api.schedule.findAllByWorkspace(workspaceId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId,
  })
}

export function useSchedulesByWorkspace(
  workspaceId: string | null | undefined,
  range: ScheduleDateRange
): UseQueryResult<ScheduleItem[]> {
  return useQuery({
    queryKey: [
      SCHEDULE_KEY,
      'workspace',
      workspaceId,
      range.start.toISOString(),
      range.end.toISOString(),
    ],
    queryFn: async (): Promise<ScheduleItem[]> => {
      const res: IpcResponse<ScheduleItem[]> = await window.api.schedule.findByWorkspace(
        workspaceId!,
        range
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId,
  })
}

export function useScheduleById(
  scheduleId: string | undefined
): UseQueryResult<ScheduleItem> {
  return useQuery({
    queryKey: [SCHEDULE_KEY, 'detail', scheduleId],
    queryFn: async (): Promise<ScheduleItem> => {
      const res: IpcResponse<ScheduleItem> = await window.api.schedule.findById(scheduleId!)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    enabled: !!scheduleId,
  })
}

export function useLinkedTodos(
  scheduleId: string | undefined
): UseQueryResult<TodoItem[]> {
  return useQuery({
    queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId],
    queryFn: async (): Promise<TodoItem[]> => {
      const res: IpcResponse<TodoItem[]> = await window.api.schedule.getLinkedTodos(scheduleId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!scheduleId,
  })
}

// --- Mutations ---

export function useCreateSchedule(): UseMutationResult<
  ScheduleItem,
  Error,
  { workspaceId: string; data: CreateScheduleData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, data }) => {
      const res = await window.api.schedule.create(workspaceId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'workspace', workspaceId],
      })
    },
  })
}

export function useUpdateSchedule(): UseMutationResult<
  ScheduleItem,
  Error,
  { scheduleId: string; data: UpdateScheduleData; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, data }) => {
      const res = await window.api.schedule.update(scheduleId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'workspace', workspaceId],
      })
    },
  })
}

export function useRemoveSchedule(): UseMutationResult<
  void,
  Error,
  { scheduleId: string; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId }) => {
      const res = await window.api.schedule.remove(scheduleId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'workspace', workspaceId],
      })
    },
  })
}

export function useMoveSchedule(): UseMutationResult<
  ScheduleItem,
  Error,
  { scheduleId: string; startAt: Date; endAt: Date; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, startAt, endAt }) => {
      const res = await window.api.schedule.move(scheduleId, startAt, endAt)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'workspace', workspaceId],
      })
    },
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
        queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId],
      })
    },
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
        queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId],
      })
    },
  })
}
