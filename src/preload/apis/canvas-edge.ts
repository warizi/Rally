import { ipcRenderer } from 'electron'

export const canvasEdgeApi = {
  findByCanvas: (canvasId: string) => ipcRenderer.invoke('canvasEdge:findByCanvas', canvasId),
  create: (canvasId: string, data: unknown) =>
    ipcRenderer.invoke('canvasEdge:create', canvasId, data),
  update: (edgeId: string, data: unknown) => ipcRenderer.invoke('canvasEdge:update', edgeId, data),
  remove: (edgeId: string) => ipcRenderer.invoke('canvasEdge:remove', edgeId)
}
