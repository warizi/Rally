import { ElectronAPI } from '@electron-toolkit/preload'
import type { Workspace } from '../main/repositories/workspace'
import type { IpcResponse } from '../main/lib/ipc-response'

interface WorkspaceAPI {
  getAll: () => Promise<IpcResponse<Workspace[]>>
  getById: (id: string) => Promise<IpcResponse<Workspace>>
  create: (name: string) => Promise<IpcResponse<Workspace>>
  update: (
    id: string,
    data: Partial<Pick<Workspace, 'name' | 'updatedAt'>>
  ) => Promise<IpcResponse<Workspace>>
  delete: (id: string) => Promise<IpcResponse<void>>
}

interface API {
  workspace: WorkspaceAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
