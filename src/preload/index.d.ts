import { ElectronAPI } from '@electron-toolkit/preload'
import type { Workspace } from '../main/repositories/workspace'
import type { TabSession, TabSessionInsert } from '../main/repositories/tab-session'
import type { TabSnapshot } from '../main/repositories/tab-snapshot'
import type { IpcResponse } from '../main/lib/ipc-response'

interface TabSessionAPI {
  getByWorkspaceId: (workspaceId: string) => Promise<IpcResponse<TabSession>>
  create: (data: Omit<TabSessionInsert, 'updatedAt'>) => Promise<IpcResponse<TabSession>>
  update: (data: Omit<TabSession, 'updatedAt'>) => Promise<IpcResponse<TabSession>>
}

interface TabSnapshotAPI {
  getByWorkspaceId: (workspaceId: string) => Promise<IpcResponse<TabSnapshot[]>>
  create: (data: {
    name: string
    description?: string
    workspaceId: string
    tabsJson: string
    panesJson: string
    layoutJson: string
  }) => Promise<IpcResponse<TabSnapshot>>
  update: (
    id: string,
    data: {
      name?: string
      description?: string
      tabsJson?: string
      panesJson?: string
      layoutJson?: string
    }
  ) => Promise<IpcResponse<TabSnapshot>>
  delete: (id: string) => Promise<IpcResponse<void>>
}

interface NoteNode {
  id: string
  title: string
  relativePath: string
  description: string
  preview: string
  folderId: string | null
  order: number
  createdAt: Date
  updatedAt: Date
}

interface NoteAPI {
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
  onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => () => void
}

interface FolderNode {
  id: string
  name: string
  relativePath: string
  color: string | null
  order: number
  children: FolderNode[]
}

interface FolderAPI {
  readTree: (workspaceId: string) => Promise<IpcResponse<FolderNode[]>>
  create: (
    workspaceId: string,
    parentFolderId: string | null,
    name: string
  ) => Promise<IpcResponse<FolderNode>>
  rename: (
    workspaceId: string,
    folderId: string,
    newName: string
  ) => Promise<IpcResponse<FolderNode>>
  remove: (workspaceId: string, folderId: string) => Promise<IpcResponse<void>>
  move: (
    workspaceId: string,
    folderId: string,
    parentFolderId: string | null,
    index: number
  ) => Promise<IpcResponse<FolderNode>>
  updateMeta: (
    workspaceId: string,
    folderId: string,
    data: { color?: string | null; order?: number }
  ) => Promise<IpcResponse<FolderNode>>
  onChanged: (callback: (workspaceId: string) => void) => () => void
}

interface WorkspaceAPI {
  getAll: () => Promise<IpcResponse<Workspace[]>>
  getById: (id: string) => Promise<IpcResponse<Workspace>>
  create: (name: string, path: string) => Promise<IpcResponse<Workspace>>
  update: (
    id: string,
    data: Partial<Pick<Workspace, 'name' | 'path' | 'updatedAt'>>
  ) => Promise<IpcResponse<Workspace>>
  delete: (id: string) => Promise<IpcResponse<void>>
  selectDirectory: () => Promise<string | null>
}

interface API {
  note: NoteAPI
  folder: FolderAPI
  tabSession: TabSessionAPI
  tabSnapshot: TabSnapshotAPI
  workspace: WorkspaceAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
