import type { IpcResponse } from './common'

export type TaggableEntityType = 'note' | 'todo' | 'image' | 'pdf' | 'csv' | 'canvas' | 'folder'

export interface TagItem {
  id: string
  workspaceId: string
  name: string
  color: string
  description: string | null
  createdAt: Date
  createdBy?: 'user' | 'ai'
  createdById?: string | null
  updatedBy?: 'user' | 'ai'
  updatedById?: string | null
}

export interface CreateTagInput {
  name: string
  color: string
  description?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string
  description?: string | null
}

export interface TagAPI {
  getAll: (workspaceId: string) => Promise<IpcResponse<TagItem[]>>
  create: (workspaceId: string, input: CreateTagInput) => Promise<IpcResponse<TagItem>>
  update: (id: string, input: UpdateTagInput) => Promise<IpcResponse<TagItem>>
  remove: (id: string) => Promise<IpcResponse<void>>
  onChanged: (callback: (workspaceId: string) => void) => () => void
}

export interface ItemTagAPI {
  getTagsByItem: (itemType: TaggableEntityType, itemId: string) => Promise<IpcResponse<TagItem[]>>
  getItemIdsByTag: (tagId: string, itemType: TaggableEntityType) => Promise<IpcResponse<string[]>>
  attach: (
    itemType: TaggableEntityType,
    tagId: string,
    itemId: string
  ) => Promise<IpcResponse<void>>
  detach: (
    itemType: TaggableEntityType,
    tagId: string,
    itemId: string
  ) => Promise<IpcResponse<void>>
}
