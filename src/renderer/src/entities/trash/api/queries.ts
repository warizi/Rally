import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { TrashEntityKind, TrashListResult, TrashRetentionKey } from '../model/types'

const TRASH_KEY = 'trash'

export function useTrashList(
  workspaceId: string,
  options?: {
    types?: TrashEntityKind[]
    search?: string
    offset?: number
    limit?: number
  }
): UseQueryResult<TrashListResult, Error> {
  return useQuery({
    queryKey: [
      TRASH_KEY,
      'list',
      workspaceId,
      options?.types ?? null,
      options?.search ?? null,
      options?.offset ?? 0,
      options?.limit ?? 50
    ],
    queryFn: async (): Promise<TrashListResult> => {
      const res: IpcResponse<TrashListResult> = await window.api.trash.list(workspaceId, options)
      if (!res.success) throwIpcError(res)
      return res.data ?? { batches: [], total: 0, hasMore: false, nextOffset: 0 }
    },
    enabled: !!workspaceId
  })
}

export function useTrashCount(workspaceId: string): UseQueryResult<number, Error> {
  return useQuery({
    queryKey: [TRASH_KEY, 'count', workspaceId],
    queryFn: async (): Promise<number> => {
      const res = await window.api.trash.count(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? 0
    },
    enabled: !!workspaceId
  })
}

export function useTrashRetention(): UseQueryResult<TrashRetentionKey, Error> {
  return useQuery({
    queryKey: [TRASH_KEY, 'retention'],
    queryFn: async (): Promise<TrashRetentionKey> => {
      const res = await window.api.trash.getRetention()
      if (!res.success) throwIpcError(res)
      return (res.data as TrashRetentionKey) ?? '30'
    }
  })
}
