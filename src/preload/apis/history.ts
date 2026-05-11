import { ipcRenderer } from 'electron'

export const historyApi = {
  fetch: (
    workspaceId: string,
    options?: {
      dayOffset?: number
      dayLimit?: number
      fromDate?: string | null
      toDate?: string | null
      query?: string | null
    }
  ) => ipcRenderer.invoke('history:fetch', workspaceId, options)
}
