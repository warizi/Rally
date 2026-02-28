import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { IpcResponse } from '@shared/types/ipc'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { Workspace } from '../model/types'

const QUERY_KEY = 'workspaces'

type UpdateWorkspaceInput = { id: string; name?: string; path?: string }

export function useWorkspaces(): UseQueryResult<Workspace[]> {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async (): Promise<Workspace[]> => {
      const res: IpcResponse<Workspace[]> = await window.api.workspace.getAll()
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    }
  })
}

export function useWorkspace(id: string): UseQueryResult<Workspace | undefined> {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async (): Promise<Workspace | undefined> => {
      const res: IpcResponse<Workspace> = await window.api.workspace.getById(id)
      if (!res.success) throwIpcError(res)
      return res.data
    }
  })
}

export function useCreateWorkspace(): UseMutationResult<
  Workspace | undefined,
  Error,
  { name: string; path: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      path
    }: {
      name: string
      path: string
    }): Promise<Workspace | undefined> => {
      const res: IpcResponse<Workspace> = await window.api.workspace.create(name, path)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (data) => {
      // Append to cache immediately so WorkspaceInitializer sees the new workspace
      // before the async invalidation refetch completes — prevents race condition
      // where it would override setCurrentWorkspaceId with the old workspace.
      if (data) {
        queryClient.setQueryData<Workspace[]>([QUERY_KEY], (old) => [...(old ?? []), data])
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    }
  })
}

export function useUpdateWorkspace(): UseMutationResult<
  Workspace | undefined,
  Error,
  UpdateWorkspaceInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      path
    }: UpdateWorkspaceInput): Promise<Workspace | undefined> => {
      const res: IpcResponse<Workspace> = await window.api.workspace.update(id, { name, path })
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, id] })
    }
  })
}

export function useDeleteWorkspace(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res: IpcResponse = await window.api.workspace.delete(id)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    }
  })
}
