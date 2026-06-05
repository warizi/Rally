import type { IpcResponse, WatcherActor } from './common'

export interface NoteNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: 'user' | 'ai'
  createdById: string | null
  updatedBy: 'user' | 'ai'
  updatedById: string | null
}

export interface NoteAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<NoteNode[]>>
  create: (
    workspaceId: string,
    folderId: string | null,
    name: string
  ) => Promise<IpcResponse<NoteNode>>
  rename: (workspaceId: string, noteId: string, newName: string) => Promise<IpcResponse<NoteNode>>
  remove: (workspaceId: string, noteId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, noteId: string) => Promise<IpcResponse<string>>
  writeContent: (workspaceId: string, noteId: string, content: string) => Promise<IpcResponse<void>>
  move: (
    workspaceId: string,
    noteId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<NoteNode>>
  updateMeta: (
    workspaceId: string,
    noteId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<NoteNode>>
  import: (
    workspaceId: string,
    folderId: string | null,
    sourcePath: string
  ) => Promise<IpcResponse<NoteNode>>
  duplicate: (workspaceId: string, noteId: string) => Promise<IpcResponse<NoteNode>>
  toggleLock: (
    workspaceId: string,
    noteId: string,
    isLocked: boolean
  ) => Promise<IpcResponse<NoteNode>>
  selectFile: () => Promise<string[] | null>
  onChanged: (
    callback: (workspaceId: string, changedRelPaths: string[], actor: WatcherActor | null) => void
  ) => () => void
}
