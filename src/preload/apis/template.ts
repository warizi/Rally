import { ipcRenderer } from 'electron'

export const templateApi = {
  list: (workspaceId: string, type: 'note' | 'csv') =>
    ipcRenderer.invoke('template:list', workspaceId, type),
  create: (input: { workspaceId: string; title: string; type: 'note' | 'csv'; jsonData: string }) =>
    ipcRenderer.invoke('template:create', input),
  delete: (id: string) => ipcRenderer.invoke('template:delete', id),
  onChanged: (callback: (workspaceId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, workspaceId: string): void =>
      callback(workspaceId)
    ipcRenderer.on('template:changed', handler)
    return () => ipcRenderer.removeListener('template:changed', handler)
  }
}
