import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { ImageFileNode } from '../model/types'
import { markWorkspaceOwnWrite } from '@shared/lib/workspace-own-write'
import { markAsOwnWrite } from '../model/own-write-tracker'

const IMAGE_KEY = 'image'

export function useImageFilesByWorkspace(workspaceId: string): UseQueryResult<ImageFileNode[]> {
  return useQuery({
    queryKey: [IMAGE_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<ImageFileNode[]> => {
      const res: IpcResponse<ImageFileNode[]> = await window.api.image.readByWorkspace(workspaceId)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useImportImageFile(): UseMutationResult<
  ImageFileNode | undefined,
  Error,
  { workspaceId: string; folderId: string | null; sourcePath: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, folderId, sourcePath }) => {
      const res: IpcResponse<ImageFileNode> = await window.api.image.import(
        workspaceId,
        folderId,
        sourcePath
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRenameImageFile(): UseMutationResult<
  ImageFileNode | undefined,
  Error,
  { workspaceId: string; imageId: string; newName: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId, imageId }) => {
      markWorkspaceOwnWrite(workspaceId)
      markAsOwnWrite(imageId)
    },
    mutationFn: async ({ workspaceId, imageId, newName }) => {
      const res: IpcResponse<ImageFileNode> = await window.api.image.rename(
        workspaceId,
        imageId,
        newName
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemoveImageFile(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; imageId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, imageId }) => {
      const res: IpcResponse<void> = await window.api.image.remove(workspaceId, imageId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReadImageContent(
  workspaceId: string,
  imageId: string
): UseQueryResult<{ data: ArrayBuffer }> {
  return useQuery({
    queryKey: [IMAGE_KEY, 'content', imageId],
    queryFn: async (): Promise<{ data: ArrayBuffer }> => {
      const res: IpcResponse<{ data: ArrayBuffer }> = await window.api.image.readContent(
        workspaceId,
        imageId
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? { data: new ArrayBuffer(0) }
    },
    enabled: !!workspaceId && !!imageId,
    staleTime: Infinity
  })
}

export function useMoveImageFile(): UseMutationResult<
  ImageFileNode | undefined,
  Error,
  { workspaceId: string; imageId: string; folderId: string | null; index: number }
> {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: ({ workspaceId }) => {
      markWorkspaceOwnWrite(workspaceId)
    },
    mutationFn: async ({ workspaceId, imageId, folderId, index }) => {
      const res: IpcResponse<ImageFileNode> = await window.api.image.move(
        workspaceId,
        imageId,
        folderId,
        index
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useUpdateImageMeta(): UseMutationResult<
  ImageFileNode | undefined,
  Error,
  { workspaceId: string; imageId: string; data: { description?: string } }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, imageId, data }) => {
      const res: IpcResponse<ImageFileNode> = await window.api.image.updateMeta(
        workspaceId,
        imageId,
        data
      )
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [IMAGE_KEY, 'workspace', workspaceId] })
    }
  })
}
