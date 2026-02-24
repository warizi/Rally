import { ElectronAPI } from '@electron-toolkit/preload'
import type { Workspace } from '../main/repositories/workspace'
import type { TabSession, TabSessionInsert } from '../main/repositories/tab-session'
import type { IpcResponse } from '../main/lib/ipc-response'

interface TabSessionAPI {
  getByWorkspaceId: (workspaceId: string) => Promise<IpcResponse<TabSession>>
  create: (data: Omit<TabSessionInsert, 'updatedAt'>) => Promise<IpcResponse<TabSession>>
  update: (data: Omit<TabSession, 'updatedAt'>) => Promise<IpcResponse<TabSession>>
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
  tabSession: TabSessionAPI
  workspace: WorkspaceAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
