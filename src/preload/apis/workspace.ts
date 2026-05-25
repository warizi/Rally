import { ipcRenderer } from 'electron'
import { createOnChangedListener } from '../lib/on-changed-listener'

export const workspaceApi = {
  getAll: () => ipcRenderer.invoke('workspace:getAll'),
  getById: (id: string) => ipcRenderer.invoke('workspace:getById', id),
  create: (name: string, path: string) => ipcRenderer.invoke('workspace:create', name, path),
  update: (id: string, data: unknown) => ipcRenderer.invoke('workspace:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('workspace:delete', id),
  activate: (id: string) => ipcRenderer.invoke('workspace:activate', id),
  selectDirectory: () => ipcRenderer.invoke('workspace:selectDirectory'),
  // MCP manage_workspace(switch) → main 이 BrowserWindow 로 브로드캐스트.
  // 두번째 인자(paths) 는 broadcastChanged 시그니처 유지를 위해 빈 배열로 옴.
  onActiveChanged: createOnChangedListener('workspace:active-changed')
}
