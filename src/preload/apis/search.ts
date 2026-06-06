import { ipcRenderer } from 'electron'

export const searchApi = {
  query: (workspaceId: string, query: string, options?: unknown) =>
    ipcRenderer.invoke('search:query', workspaceId, query, options)
}
