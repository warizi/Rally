import { ipcRenderer } from 'electron'
import { createOnChangedListener } from '../lib/on-changed-listener'

export const csvApi = {
  readByWorkspace: (workspaceId: string) => ipcRenderer.invoke('csv:readByWorkspace', workspaceId),
  create: (workspaceId: string, folderId: string | null, name: string) =>
    ipcRenderer.invoke('csv:create', workspaceId, folderId, name),
  rename: (workspaceId: string, csvId: string, newName: string) =>
    ipcRenderer.invoke('csv:rename', workspaceId, csvId, newName),
  remove: (workspaceId: string, csvId: string) =>
    ipcRenderer.invoke('csv:remove', workspaceId, csvId),
  readContent: (workspaceId: string, csvId: string) =>
    ipcRenderer.invoke('csv:readContent', workspaceId, csvId),
  writeContent: (workspaceId: string, csvId: string, content: string) =>
    ipcRenderer.invoke('csv:writeContent', workspaceId, csvId, content),
  move: (workspaceId: string, csvId: string, folderId: string | null, index: number) =>
    ipcRenderer.invoke('csv:move', workspaceId, csvId, folderId, index),
  updateMeta: (
    workspaceId: string,
    csvId: string,
    data: { description?: string; columnWidths?: string }
  ) => ipcRenderer.invoke('csv:updateMeta', workspaceId, csvId, data),
  import: (workspaceId: string, folderId: string | null, sourcePath: string) =>
    ipcRenderer.invoke('csv:import', workspaceId, folderId, sourcePath),
  duplicate: (workspaceId: string, csvId: string) =>
    ipcRenderer.invoke('csv:duplicate', workspaceId, csvId),
  selectFile: () => ipcRenderer.invoke('csv:selectFile'),
  onChanged: createOnChangedListener('csv:changed')
}
