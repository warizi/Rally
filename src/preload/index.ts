import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { TabSession, TabSessionInsert } from '../main/repositories/tab-session'

const api = {
  tabSession: {
    getByWorkspaceId: (workspaceId: string) =>
      ipcRenderer.invoke('tabSession:getByWorkspaceId', workspaceId),
    create: (data: Omit<TabSessionInsert, 'updatedAt'>) =>
      ipcRenderer.invoke('tabSession:create', data),
    update: (data: Omit<TabSession, 'updatedAt'>) => ipcRenderer.invoke('tabSession:update', data)
  },

  workspace: {
    getAll: () => ipcRenderer.invoke('workspace:getAll'),
    getById: (id: string) => ipcRenderer.invoke('workspace:getById', id),
    create: (name: string) => ipcRenderer.invoke('workspace:create', name),
    update: (id: string, data: unknown) => ipcRenderer.invoke('workspace:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('workspace:delete', id)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
