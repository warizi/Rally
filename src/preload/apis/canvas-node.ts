import { ipcRenderer } from 'electron'

export const canvasNodeApi = {
  findByCanvas: (canvasId: string) => ipcRenderer.invoke('canvasNode:findByCanvas', canvasId),
  create: (canvasId: string, data: unknown) =>
    ipcRenderer.invoke('canvasNode:create', canvasId, data),
  update: (nodeId: string, data: unknown) => ipcRenderer.invoke('canvasNode:update', nodeId, data),
  updatePositions: (updates: unknown) => ipcRenderer.invoke('canvasNode:updatePositions', updates),
  remove: (nodeId: string) => ipcRenderer.invoke('canvasNode:remove', nodeId),
  syncState: (canvasId: string, data: unknown) =>
    ipcRenderer.invoke('canvasNode:syncState', canvasId, data)
}
