import { ipcRenderer } from 'electron'

export type TabSnapshotCreateInput = {
  name: string
  description?: string
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
}

export const tabSnapshotApi = {
  getByWorkspaceId: (workspaceId: string) =>
    ipcRenderer.invoke('tabSnapshot:getByWorkspaceId', workspaceId),
  create: (data: TabSnapshotCreateInput) => ipcRenderer.invoke('tabSnapshot:create', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    ipcRenderer.invoke('tabSnapshot:update', id, data),
  delete: (id: string) => ipcRenderer.invoke('tabSnapshot:delete', id)
}
