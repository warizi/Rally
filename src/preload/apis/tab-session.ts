import { ipcRenderer } from 'electron'
import type { TabSessionUpsertInput } from '../types/tab'

export const tabSessionApi = {
  getByWorkspaceId: (workspaceId: string) =>
    ipcRenderer.invoke('tabSession:getByWorkspaceId', workspaceId),
  upsert: (data: TabSessionUpsertInput) => ipcRenderer.invoke('tabSession:upsert', data)
}
