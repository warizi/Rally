import type { IpcResponse, WatcherActor } from './common'

export interface CsvFileNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  columnWidths: string | null
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

export interface CsvAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<CsvFileNode[]>>
  create: (
    workspaceId: string,
    folderId: string | null,
    name: string
  ) => Promise<IpcResponse<CsvFileNode>>
  rename: (workspaceId: string, csvId: string, newName: string) => Promise<IpcResponse<CsvFileNode>>
  remove: (workspaceId: string, csvId: string) => Promise<IpcResponse<void>>
  readContent: (
    workspaceId: string,
    csvId: string
  ) => Promise<IpcResponse<{ content: string; encoding: string; columnWidths: string | null }>>
  writeContent: (workspaceId: string, csvId: string, content: string) => Promise<IpcResponse<void>>
  move: (
    workspaceId: string,
    csvId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<CsvFileNode>>
  updateMeta: (
    workspaceId: string,
    csvId: string,
    data: { description?: string; columnWidths?: string }
  ) => Promise<IpcResponse<CsvFileNode>>
  import: (
    workspaceId: string,
    folderId: string | null,
    sourcePath: string
  ) => Promise<IpcResponse<CsvFileNode>>
  duplicate: (workspaceId: string, csvId: string) => Promise<IpcResponse<CsvFileNode>>
  toggleLock: (
    workspaceId: string,
    csvId: string,
    isLocked: boolean
  ) => Promise<IpcResponse<CsvFileNode>>
  selectFile: () => Promise<string[] | null>
  onChanged: (
    callback: (workspaceId: string, changedRelPaths: string[], actor: WatcherActor | null) => void
  ) => () => void
}
