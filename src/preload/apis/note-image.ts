import { ipcRenderer } from 'electron'

export const noteImageApi = {
  saveFromPath: (workspaceId: string, sourcePath: string) =>
    ipcRenderer.invoke('noteImage:saveFromPath', workspaceId, sourcePath),
  saveFromBuffer: (workspaceId: string, buffer: ArrayBuffer, ext: string) =>
    ipcRenderer.invoke('noteImage:saveFromBuffer', workspaceId, buffer, ext),
  readImage: (workspaceId: string, relativePath: string) =>
    ipcRenderer.invoke('noteImage:readImage', workspaceId, relativePath)
}
