import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { TagItem, TaggableEntityType, CreateTagInput, UpdateTagInput } from './types'

export const TAG_KEY = 'tag'
export const ITEM_TAG_KEY = 'itemTag'

export function useTags(workspaceId: string | undefined): UseQueryResult<TagItem[]> {
  return useQuery({
    queryKey: [TAG_KEY, workspaceId],
    queryFn: async (): Promise<TagItem[]> => {
      const res: IpcResponse<TagItem[]> = await window.api.tag.getAll(workspaceId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useItemTags(
  itemType: TaggableEntityType,
  itemId: string | undefined
): UseQueryResult<TagItem[]> {
  return useQuery({
    queryKey: [ITEM_TAG_KEY, itemType, itemId],
    queryFn: async (): Promise<TagItem[]> => {
      const res: IpcResponse<TagItem[]> = await window.api.itemTag.getTagsByItem(itemType, itemId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!itemId
  })
}

export function useItemIdsByTag(
  tagId: string | undefined,
  itemType: TaggableEntityType
): UseQueryResult<string[]> {
  return useQuery({
    queryKey: [ITEM_TAG_KEY, 'byTag', tagId, itemType],
    queryFn: async (): Promise<string[]> => {
      const res: IpcResponse<string[]> = await window.api.itemTag.getItemIdsByTag(tagId!, itemType)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!tagId
  })
}

export function useCreateTag(): UseMutationResult<
  TagItem | undefined,
  Error,
  { workspaceId: string; input: CreateTagInput }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, input }) => {
      const res: IpcResponse<TagItem> = await window.api.tag.create(workspaceId, input)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TAG_KEY, workspaceId] })
    }
  })
}

export function useUpdateTag(): UseMutationResult<
  TagItem | undefined,
  Error,
  { id: string; input: UpdateTagInput; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }) => {
      const res: IpcResponse<TagItem> = await window.api.tag.update(id, input)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TAG_KEY, workspaceId] })
    }
  })
}

export function useRemoveTag(): UseMutationResult<
  void,
  Error,
  { id: string; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }) => {
      const res: IpcResponse<void> = await window.api.tag.remove(id)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TAG_KEY, workspaceId] })
      queryClient.invalidateQueries({ queryKey: [ITEM_TAG_KEY] })
    }
  })
}

export function useAttachTag(): UseMutationResult<
  void,
  Error,
  { itemType: TaggableEntityType; tagId: string; itemId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemType, tagId, itemId }) => {
      const res: IpcResponse<void> = await window.api.itemTag.attach(itemType, tagId, itemId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { itemType, itemId }) => {
      queryClient.invalidateQueries({ queryKey: [ITEM_TAG_KEY, itemType, itemId] })
    }
  })
}

export function useDetachTag(): UseMutationResult<
  void,
  Error,
  { itemType: TaggableEntityType; tagId: string; itemId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemType, tagId, itemId }) => {
      const res: IpcResponse<void> = await window.api.itemTag.detach(itemType, tagId, itemId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { itemType, itemId }) => {
      queryClient.invalidateQueries({ queryKey: [ITEM_TAG_KEY, itemType, itemId] })
    }
  })
}
