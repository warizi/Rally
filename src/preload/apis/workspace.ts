import { ipcRenderer } from 'electron'

export const workspaceApi = {
  getAll: () => ipcRenderer.invoke('workspace:getAll'),
  getById: (id: string) => ipcRenderer.invoke('workspace:getById', id),
  create: (name: string, path: string) => ipcRenderer.invoke('workspace:create', name, path),
  update: (id: string, data: unknown) => ipcRenderer.invoke('workspace:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('workspace:delete', id),
  activate: (id: string) => ipcRenderer.invoke('workspace:activate', id),
  selectDirectory: () => ipcRenderer.invoke('workspace:selectDirectory')
}
