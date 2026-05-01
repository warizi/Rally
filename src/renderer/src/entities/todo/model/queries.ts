import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { TodoItem, CreateTodoData, UpdateTodoData, TodoOrderUpdate } from './types'

const TODO_KEY = 'todo'
const HISTORY_KEY = 'history'

type TodoFindFilter = 'all' | 'active' | 'completed'

export function useTodosByWorkspace(
  workspaceId: string | null | undefined,
  options?: { filter?: TodoFindFilter }
): UseQueryResult<TodoItem[]> {
  const filter = options?.filter
  return useQuery({
    queryKey: filter
      ? [TODO_KEY, 'workspace', workspaceId, filter]
      : [TODO_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<TodoItem[]> => {
      const res: IpcResponse<TodoItem[]> = await window.api.todo.findByWorkspace(
        workspaceId!,
        filter ? { filter } : undefined
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useActiveTodosByWorkspace(
  workspaceId: string | null | undefined
): UseQueryResult<TodoItem[]> {
  return useTodosByWorkspace(workspaceId, { filter: 'active' })
}

export function useCompletedTodosByWorkspace(
  workspaceId: string | null | undefined
): UseQueryResult<TodoItem[]> {
  return useTodosByWorkspace(workspaceId, { filter: 'completed' })
}

export function useTodosByDateRange(
  workspaceId: string | null | undefined,
  range: { start: Date; end: Date } | undefined
): UseQueryResult<TodoItem[]> {
  return useQuery({
    queryKey: [
      TODO_KEY,
      'dateRange',
      workspaceId,
      range?.start?.toISOString(),
      range?.end?.toISOString()
    ],
    queryFn: async (): Promise<TodoItem[]> => {
      const res: IpcResponse<TodoItem[]> = await window.api.todo.findByDateRange(
        workspaceId!,
        range!
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId && !!range
  })
}

export function useCreateTodo(): UseMutationResult<
  TodoItem | undefined,
  Error,
  { workspaceId: string; data: CreateTodoData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, data }) => {
      const res: IpcResponse<TodoItem> = await window.api.todo.create(workspaceId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useUpdateTodo(): UseMutationResult<
  TodoItem | undefined,
  Error,
  { workspaceId: string; todoId: string; data: UpdateTodoData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ todoId, data }) => {
      const res: IpcResponse<TodoItem> = await window.api.todo.update(todoId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'dateRange', workspaceId] })
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, workspaceId] })
      // 완료 상태 변경 시 히스토리 갱신
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY, workspaceId] })
    }
  })
}

export function useRemoveTodo(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; todoId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ todoId }) => {
      const res: IpcResponse<void> = await window.api.todo.remove(todoId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
      // 완료된 todo 삭제도 히스토리에 반영
      queryClient.invalidateQueries({ queryKey: [HISTORY_KEY, workspaceId] })
    }
  })
}

export function useReorderTodoList(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; updates: TodoOrderUpdate[] }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, updates }) => {
      const res: IpcResponse<void> = await window.api.todo.reorderList(workspaceId, updates)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReorderTodoKanban(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; updates: TodoOrderUpdate[] }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, updates }) => {
      const res: IpcResponse<void> = await window.api.todo.reorderKanban(workspaceId, updates)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReorderTodoSub(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; parentId: string; updates: TodoOrderUpdate[] }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ parentId, updates }) => {
      const res: IpcResponse<void> = await window.api.todo.reorderSub(parentId, updates)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}
