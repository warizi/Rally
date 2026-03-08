import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { Workspace } from '@entities/workspace'

export function useExportBackup(): UseMutationResult<null, Error, string> {
  return useMutation({
    mutationFn: async (workspaceId: string): Promise<null> => {
      const res: IpcResponse<null> = await window.api.backup.export(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? null
    }
  })
}

interface ImportBackupParams {
  zipPath: string
  name: string
  path: string
}

export function useImportBackup(): UseMutationResult<
  Workspace | undefined,
  Error,
  ImportBackupParams
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ zipPath, name, path }: ImportBackupParams) => {
      const res: IpcResponse<Workspace> = await window.api.backup.import(zipPath, name, path)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData<Workspace[]>(['workspaces'], (old) => [...(old ?? []), data])
      }
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    }
  })
}
