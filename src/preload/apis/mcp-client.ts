import { ipcRenderer } from 'electron'

type McpClientId = 'claudeDesktop' | 'claudeCode' | 'codex'

export const mcpClientApi = {
  getStatus: () => ipcRenderer.invoke('mcpClient:getStatus'),
  register: (client: McpClientId) => ipcRenderer.invoke('mcpClient:register', client),
  unregister: (client: McpClientId) => ipcRenderer.invoke('mcpClient:unregister', client),
  // 보안-H2: 토큰 재발급. 토큰 값 자체는 렌더러로 넘기지 않고 main 이 갱신까지 완료한다.
  rotateToken: () => ipcRenderer.invoke('mcpClient:rotateToken')
}
