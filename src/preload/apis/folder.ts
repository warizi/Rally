import { ipcRenderer } from 'electron'
import { createOnChangedListener } from '../lib/on-changed-listener'

export const folderApi = {
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
  onChanged: createOnChangedListener('folder:changed')
}
