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
