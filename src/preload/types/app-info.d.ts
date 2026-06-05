import type { IpcResponse } from './common'

export interface CommandFile {
  name: string
  description: string
  content: string
}

export interface AppInfoAPI {
  getVersion: () => Promise<IpcResponse<string>>
  getMcpServerPath: () => Promise<IpcResponse<string>>
  getCommandFiles: () => Promise<IpcResponse<CommandFile[]>>
  getSkillFiles: () => Promise<IpcResponse<CommandFile[]>>
}

export type McpClientId = 'claudeDesktop' | 'claudeCode' | 'codex'

export interface McpClientStatus {
  configPath: string
  supported: boolean
  configExists: boolean
  registered: boolean
  outdated: boolean
}

export interface McpClientStatusMap {
  claudeDesktop: McpClientStatus
  claudeCode: McpClientStatus
  codex: McpClientStatus
}

export interface McpClientStatusBundle {
  status: McpClientStatusMap
  /** dev: 'rally-dev' / prod: 'rally' */
  serverKey: string
  serverConfig: Record<string, unknown>
}

export interface McpClientAPI {
  getStatus: () => Promise<IpcResponse<McpClientStatusBundle>>
  register: (client: McpClientId) => Promise<IpcResponse<McpClientStatus>>
  unregister: (client: McpClientId) => Promise<IpcResponse<McpClientStatus>>
}
