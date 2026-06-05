import type { IpcResponse, WatcherActor } from './common'

export interface ImageFileNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
}

export interface ImageAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<ImageFileNode[]>>
  import: (
    workspaceId: string,
    folderId: string | null,
    sourcePath: string
  ) => Promise<IpcResponse<ImageFileNode>>
  duplicate: (workspaceId: string, imageId: string) => Promise<IpcResponse<ImageFileNode>>
  rename: (
    workspaceId: string,
    imageId: string,
    newName: string
  ) => Promise<IpcResponse<ImageFileNode>>
  remove: (workspaceId: string, imageId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, imageId: string) => Promise<IpcResponse<{ data: ArrayBuffer }>>
  move: (
    workspaceId: string,
    imageId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<ImageFileNode>>
  updateMeta: (
    workspaceId: string,
    imageId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<ImageFileNode>>
  selectFile: () => Promise<string[] | null>
  onChanged: (
    callback: (workspaceId: string, changedRelPaths: string[], actor: WatcherActor | null) => void
  ) => () => void
}
