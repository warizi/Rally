import { ipcRenderer } from 'electron'

export const canvasGroupApi = {
  findByCanvas: (canvasId: string) => ipcRenderer.invoke('canvasGroup:findByCanvas', canvasId),
  create: (canvasId: string, data: unknown) =>
    ipcRenderer.invoke('canvasGroup:create', canvasId, data),
  update: (groupId: string, data: unknown) =>
    ipcRenderer.invoke('canvasGroup:update', groupId, data),
  remove: (groupId: string) => ipcRenderer.invoke('canvasGroup:remove', groupId)
}
