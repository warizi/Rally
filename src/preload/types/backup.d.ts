import type { IpcResponse } from './common'
import type { WorkspaceDTO } from './workspace'

export interface BackupManifest {
  version: number
  appVersion: string
  workspaceName: string
  exportedAt: string
  tables: string[]
}

export interface BackupAPI {
  export: (workspaceId: string) => Promise<IpcResponse<null>>
  selectFile: () => Promise<string | null>
  readManifest: (zipPath: string) => Promise<IpcResponse<BackupManifest>>
  import: (zipPath: string, name: string, path: string) => Promise<IpcResponse<WorkspaceDTO>>
}
