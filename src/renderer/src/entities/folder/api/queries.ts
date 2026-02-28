import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { FolderNode } from '../model/types'
import { markWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'

const TREE_KEY = 'folder'

export function useFolderTree(workspaceId: string): UseQueryResult<FolderNode[]> {
  return useQuery({
    queryKey: [TREE_KEY, 'tree', workspaceId],
    queryFn: async (): Promise<FolderNode[]> => {
      const res: IpcResponse<FolderNode[]> = await window.api.folder.readTree(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateFolder(): UseMutationResult<
  FolderNode | undefined,
  Error,
  { workspaceId: string; parentFolderId: string | null; name: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, parentFolderId, name }) => {
      const res: IpcResponse<FolderNode> = await window.api.folder.create(
        workspaceId,
        parentFolderId,
        name
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}

export function useRenameFolder(): UseMutationResult<
  FolderNode | undefined,
  Error,
  { workspaceId: string; folderId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, folderId, newName }) => {
      const res: IpcResponse<FolderNode> = await window.api.folder.rename(
        workspaceId,
        folderId,
        newName
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}

export function useRemoveFolder(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; folderId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, folderId }) => {
      const res: IpcResponse<void> = await window.api.folder.remove(workspaceId, folderId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}

export function useMoveFolder(): UseMutationResult<
  FolderNode | undefined,
  Error,
  { workspaceId: string; folderId: string; parentFolderId: string | null; index: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, folderId, parentFolderId, index }) => {
      const res: IpcResponse<FolderNode> = await window.api.folder.move(
        workspaceId,
        folderId,
        parentFolderId,
        index
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}

export function useUpdateFolderMeta(): UseMutationResult<
  FolderNode | undefined,
  Error,
  { workspaceId: string; folderId: string; data: { color?: string | null; order?: number } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, folderId, data }) => {
      const res: IpcResponse<FolderNode> = await window.api.folder.updateMeta(
        workspaceId,
        folderId,
        data
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TREE_KEY, 'tree', workspaceId] })
    }
  })
}
