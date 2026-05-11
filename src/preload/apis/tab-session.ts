import { ipcRenderer } from 'electron'
import type { TabSessionInsert } from '../../main/repositories/tab-session'

export const tabSessionApi = {
  getByWorkspaceId: (workspaceId: string) =>
    ipcRenderer.invoke('tabSession:getByWorkspaceId', workspaceId),
  upsert: (data: Omit<TabSessionInsert, 'updatedAt'>) =>
    ipcRenderer.invoke('tabSession:upsert', data)
}
