import { ipcRenderer } from 'electron'

export const mcpClientApi = {
  getStatus: () => ipcRenderer.invoke('mcpClient:getStatus'),
  register: (client: 'claudeDesktop' | 'claudeCode') =>
    ipcRenderer.invoke('mcpClient:register', client),
  unregister: (client: 'claudeDesktop' | 'claudeCode') =>
    ipcRenderer.invoke('mcpClient:unregister', client)
}
