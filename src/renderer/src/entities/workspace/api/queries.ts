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

type UpdateWorkspaceInput = { id: string; name: string }


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

export function useCreateWorkspace(): UseMutationResult<Workspace | undefined, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string): Promise<Workspace | undefined> => {
      const res: IpcResponse<Workspace> = await window.api.workspace.create(name)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => {
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
    mutationFn: async ({ id, name }: UpdateWorkspaceInput): Promise<Workspace | undefined> => {
      const res: IpcResponse<Workspace> = await window.api.workspace.update(id, { name })
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
