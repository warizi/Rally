import { ipcRenderer } from 'electron'

export const tagApi = {
  getAll: (workspaceId: string) => ipcRenderer.invoke('tag:getAll', workspaceId),
  create: (workspaceId: string, input: unknown) =>
    ipcRenderer.invoke('tag:create', workspaceId, input),
  update: (id: string, input: unknown) => ipcRenderer.invoke('tag:update', id, input),
  remove: (id: string) => ipcRenderer.invoke('tag:remove', id),
  onChanged: (callback: (workspaceId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, workspaceId: string): void =>
      callback(workspaceId)
    ipcRenderer.on('tag:changed', handler)
    return () => ipcRenderer.removeListener('tag:changed', handler)
  }
}
