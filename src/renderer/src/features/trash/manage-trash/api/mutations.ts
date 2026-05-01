import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { TrashRetentionKey } from '@entities/trash'

function invalidateTrash(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: ['trash'] })
}

export function useRestoreTrash(): UseMutationResult<
  unknown,
  Error,
  { workspaceId: string; batchId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, batchId }) => {
      const res = await window.api.trash.restore(workspaceId, batchId)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => invalidateTrash(qc)
  })
}

export function usePurgeTrash(): UseMutationResult<
  unknown,
  Error,
  { workspaceId: string; batchId: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, batchId }) => {
      const res = await window.api.trash.purge(workspaceId, batchId)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => invalidateTrash(qc)
  })
}

export function useEmptyTrash(): UseMutationResult<unknown, Error, { workspaceId: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId }) => {
      const res = await window.api.trash.emptyAll(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => invalidateTrash(qc)
  })
}

export function useSetTrashRetention(): UseMutationResult<unknown, Error, TrashRetentionKey> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (value) => {
      const res = await window.api.trash.setRetention(value)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trash', 'retention'] })
  })
}
