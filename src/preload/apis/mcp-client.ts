import { ipcRenderer } from 'electron'

type McpClientId = 'claudeDesktop' | 'claudeCode' | 'codex'

export const mcpClientApi = {
  getStatus: () => ipcRenderer.invoke('mcpClient:getStatus'),
  register: (client: McpClientId) => ipcRenderer.invoke('mcpClient:register', client),
  unregister: (client: McpClientId) => ipcRenderer.invoke('mcpClient:unregister', client)
}
