import { ipcRenderer } from 'electron'
import { createOnChangedListener } from '../lib/on-changed-listener'

export const noteApi = {
  readByWorkspace: (workspaceId: string) => ipcRenderer.invoke('note:readByWorkspace', workspaceId),
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
  import: (workspaceId: string, folderId: string | null, sourcePath: string) =>
    ipcRenderer.invoke('note:import', workspaceId, folderId, sourcePath),
  duplicate: (workspaceId: string, noteId: string) =>
    ipcRenderer.invoke('note:duplicate', workspaceId, noteId),
  toggleLock: (workspaceId: string, noteId: string, isLocked: boolean) =>
    ipcRenderer.invoke('note:toggleLock', workspaceId, noteId, isLocked),
  selectFile: () => ipcRenderer.invoke('note:selectFile'),
  onChanged: createOnChangedListener('note:changed')
}
