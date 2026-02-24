import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { TabSession, TabSessionInsert } from '../main/repositories/tab-session'

type TabSnapshotCreateInput = {
  name: string
  description?: string
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
}

const api = {
  tabSession: {
    getByWorkspaceId: (workspaceId: string) =>
      ipcRenderer.invoke('tabSession:getByWorkspaceId', workspaceId),
    create: (data: Omit<TabSessionInsert, 'updatedAt'>) =>
      ipcRenderer.invoke('tabSession:create', data),
    update: (data: Omit<TabSession, 'updatedAt'>) => ipcRenderer.invoke('tabSession:update', data)
  },

  tabSnapshot: {
    getByWorkspaceId: (workspaceId: string) =>
      ipcRenderer.invoke('tabSnapshot:getByWorkspaceId', workspaceId),
    create: (data: TabSnapshotCreateInput) => ipcRenderer.invoke('tabSnapshot:create', data),
    update: (id: string, data: { name?: string; description?: string }) =>
      ipcRenderer.invoke('tabSnapshot:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('tabSnapshot:delete', id)
  },

  workspace: {
    getAll: () => ipcRenderer.invoke('workspace:getAll'),
    getById: (id: string) => ipcRenderer.invoke('workspace:getById', id),
    create: (name: string, path: string) => ipcRenderer.invoke('workspace:create', name, path),
    update: (id: string, data: unknown) => ipcRenderer.invoke('workspace:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('workspace:delete', id),
    selectDirectory: () => ipcRenderer.invoke('workspace:selectDirectory')
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
