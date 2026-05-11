import { ipcRenderer } from 'electron'

export const templateApi = {
  list: (workspaceId: string, type: 'note' | 'csv') =>
    ipcRenderer.invoke('template:list', workspaceId, type),
  create: (input: { workspaceId: string; title: string; type: 'note' | 'csv'; jsonData: string }) =>
    ipcRenderer.invoke('template:create', input),
  delete: (id: string) => ipcRenderer.invoke('template:delete', id)
}
