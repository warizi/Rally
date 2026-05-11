import { ipcRenderer } from 'electron'
import { createOnChangedListener } from '../lib/on-changed-listener'

export const imageApi = {
  readByWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('image:readByWorkspace', workspaceId),
  import: (workspaceId: string, folderId: string | null, sourcePath: string) =>
    ipcRenderer.invoke('image:import', workspaceId, folderId, sourcePath),
  duplicate: (workspaceId: string, imageId: string) =>
    ipcRenderer.invoke('image:duplicate', workspaceId, imageId),
  rename: (workspaceId: string, imageId: string, newName: string) =>
    ipcRenderer.invoke('image:rename', workspaceId, imageId, newName),
  remove: (workspaceId: string, imageId: string) =>
    ipcRenderer.invoke('image:remove', workspaceId, imageId),
  readContent: (workspaceId: string, imageId: string) =>
    ipcRenderer.invoke('image:readContent', workspaceId, imageId),
  move: (workspaceId: string, imageId: string, folderId: string | null, index: number) =>
    ipcRenderer.invoke('image:move', workspaceId, imageId, folderId, index),
  updateMeta: (workspaceId: string, imageId: string, data: { description?: string }) =>
    ipcRenderer.invoke('image:updateMeta', workspaceId, imageId, data),
  selectFile: () => ipcRenderer.invoke('image:selectFile'),
  onChanged: createOnChangedListener('image:changed')
}
