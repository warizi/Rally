import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { TrashRetentionKey } from '@entities/trash'

function invalidateTrash(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: ['trash'] })
}

/**
 * 휴지통이 다루는 일부 entity (예: custom_skill) 는 자체 list 쿼리를 별도 위치에서 보여준다.
 * trash 액션 후 해당 list 도 stale 이 되므로 함께 invalidate.
 * (workspace-scoped entity 들은 자체 fs watcher / broadcast 로 자동 갱신되어 추가 invalidate 불요.)
 */
function invalidateGlobalEntityLists(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: ['skill'] })
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
    onSuccess: () => {
      invalidateTrash(qc)
      invalidateGlobalEntityLists(qc)
    }
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
    onSuccess: () => {
      invalidateTrash(qc)
      // purge 는 활성 목록 자체에는 영향 없지만, hard delete 후 잔여 cache 정합 위해 함께 무효화.
      invalidateGlobalEntityLists(qc)
    }
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
    onSuccess: () => {
      invalidateTrash(qc)
      invalidateGlobalEntityLists(qc)
    }
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
