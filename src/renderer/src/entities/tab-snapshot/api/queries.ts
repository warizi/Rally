import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { IpcResponse } from '@shared/types/ipc'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { TabSnapshot } from '../model/types'

const QUERY_KEY = 'tabSnapshots'

type CreateInput = {
  name: string
  description?: string
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
}

type UpdateInput = {
  id: string
  name?: string
  description?: string
  tabsJson?: string
  panesJson?: string
  layoutJson?: string
}

export function useTabSnapshots(workspaceId: string): UseQueryResult<TabSnapshot[]> {
  return useQuery({
    queryKey: [QUERY_KEY, workspaceId],
    queryFn: async (): Promise<TabSnapshot[]> => {
      const res: IpcResponse<TabSnapshot[]> =
        await window.api.tabSnapshot.getByWorkspaceId(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateTabSnapshot(): UseMutationResult<
  TabSnapshot | undefined,
  Error,
  CreateInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateInput): Promise<TabSnapshot | undefined> => {
      const res: IpcResponse<TabSnapshot> = await window.api.tabSnapshot.create(data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, data?.workspaceId] })
    }
  })
}

export function useUpdateTabSnapshot(): UseMutationResult<
  TabSnapshot | undefined,
  Error,
  UpdateInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      tabsJson,
      panesJson,
      layoutJson
    }: UpdateInput): Promise<TabSnapshot | undefined> => {
      const res: IpcResponse<TabSnapshot> = await window.api.tabSnapshot.update(id, {
        name,
        description,
        tabsJson,
        panesJson,
        layoutJson
      })
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, data?.workspaceId] })
    }
  })
}

export function useDeleteTabSnapshot(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res: IpcResponse = await window.api.tabSnapshot.delete(id)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    }
  })
}
