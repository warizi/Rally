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
  note: {
    readByWorkspace: (workspaceId: string) =>
      ipcRenderer.invoke('note:readByWorkspace', workspaceId),
    create: (workspaceId: string, folderId: string | null, name: string) =>
      ipcRenderer.invoke('note:create', workspaceId, folderId, name),
    rename: (workspaceId: string, noteId: string, newName: string) =>
      ipcRenderer.invoke('note:rename', workspaceId, noteId, newName),
    remove: (workspaceId: string, noteId: string) =>
      ipcRenderer.invoke('note:remove', workspaceId, noteId),
    readContent: (workspaceId: string, noteId: string) =>
      ipcRenderer.invoke('note:readContent', workspaceId, noteId),
    writeContent: (workspaceId: string, noteId: string, content: string) =>
      ipcRenderer.invoke('note:writeContent', workspaceId, noteId, content),
    move: (workspaceId: string, noteId: string, folderId: string | null, index: number) =>
      ipcRenderer.invoke('note:move', workspaceId, noteId, folderId, index),
    updateMeta: (workspaceId: string, noteId: string, data: { description?: string }) =>
      ipcRenderer.invoke('note:updateMeta', workspaceId, noteId, data),
    onChanged: (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        workspaceId: string,
        changedRelPaths: string[]
      ): void => callback(workspaceId, changedRelPaths)
      ipcRenderer.on('note:changed', handler)
      return () => ipcRenderer.removeListener('note:changed', handler)
    }
  },

  folder: {
    readTree: (workspaceId: string) => ipcRenderer.invoke('folder:readTree', workspaceId),
    create: (workspaceId: string, parentFolderId: string | null, name: string) =>
      ipcRenderer.invoke('folder:create', workspaceId, parentFolderId, name),
    rename: (workspaceId: string, folderId: string, newName: string) =>
      ipcRenderer.invoke('folder:rename', workspaceId, folderId, newName),
    remove: (workspaceId: string, folderId: string) =>
      ipcRenderer.invoke('folder:remove', workspaceId, folderId),
    move: (workspaceId: string, folderId: string, parentFolderId: string | null, index: number) =>
      ipcRenderer.invoke('folder:move', workspaceId, folderId, parentFolderId, index),
    updateMeta: (
      workspaceId: string,
      folderId: string,
      data: { color?: string | null; order?: number }
    ) => ipcRenderer.invoke('folder:updateMeta', workspaceId, folderId, data),
    onChanged: (callback: (workspaceId: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, workspaceId: string): void =>
        callback(workspaceId)
      ipcRenderer.on('folder:changed', handler)
      return () => ipcRenderer.removeListener('folder:changed', handler)
    }
  },

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
