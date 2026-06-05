import type { IpcResponse, WatcherActor } from './common'

export interface PdfFileNode {
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

export interface PdfAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<PdfFileNode[]>>
  import: (
    workspaceId: string,
    folderId: string | null,
    sourcePath: string
  ) => Promise<IpcResponse<PdfFileNode>>
  duplicate: (workspaceId: string, pdfId: string) => Promise<IpcResponse<PdfFileNode>>
  rename: (workspaceId: string, pdfId: string, newName: string) => Promise<IpcResponse<PdfFileNode>>
  remove: (workspaceId: string, pdfId: string) => Promise<IpcResponse<void>>
  readContent: (workspaceId: string, pdfId: string) => Promise<IpcResponse<{ data: ArrayBuffer }>>
  move: (
    workspaceId: string,
    pdfId: string,
    folderId: string | null,
    index: number
  ) => Promise<IpcResponse<PdfFileNode>>
  updateMeta: (
    workspaceId: string,
    pdfId: string,
    data: { description?: string }
  ) => Promise<IpcResponse<PdfFileNode>>
  selectFile: () => Promise<string | null>
  onChanged: (
    callback: (workspaceId: string, changedRelPaths: string[], actor: WatcherActor | null) => void
  ) => () => void
}
