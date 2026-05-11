import { ipcRenderer } from 'electron'
import { createOnChangedListener } from '../lib/on-changed-listener'

export const pdfApi = {
  readByWorkspace: (workspaceId: string) => ipcRenderer.invoke('pdf:readByWorkspace', workspaceId),
  import: (workspaceId: string, folderId: string | null, sourcePath: string) =>
    ipcRenderer.invoke('pdf:import', workspaceId, folderId, sourcePath),
  duplicate: (workspaceId: string, pdfId: string) =>
    ipcRenderer.invoke('pdf:duplicate', workspaceId, pdfId),
  rename: (workspaceId: string, pdfId: string, newName: string) =>
    ipcRenderer.invoke('pdf:rename', workspaceId, pdfId, newName),
  remove: (workspaceId: string, pdfId: string) =>
    ipcRenderer.invoke('pdf:remove', workspaceId, pdfId),
  readContent: (workspaceId: string, pdfId: string) =>
    ipcRenderer.invoke('pdf:readContent', workspaceId, pdfId),
  move: (workspaceId: string, pdfId: string, folderId: string | null, index: number) =>
    ipcRenderer.invoke('pdf:move', workspaceId, pdfId, folderId, index),
  updateMeta: (workspaceId: string, pdfId: string, data: { description?: string }) =>
    ipcRenderer.invoke('pdf:updateMeta', workspaceId, pdfId, data),
  selectFile: () => ipcRenderer.invoke('pdf:selectFile'),
  onChanged: createOnChangedListener('pdf:changed')
}
