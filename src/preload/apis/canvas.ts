import { ipcRenderer } from 'electron'
import { createOnChangedListener } from '../lib/on-changed-listener'

export const canvasApi = {
  findByWorkspace: (workspaceId: string, options?: { search?: string }) =>
    ipcRenderer.invoke('canvas:findByWorkspace', workspaceId, options),
  findById: (canvasId: string) => ipcRenderer.invoke('canvas:findById', canvasId),
  create: (workspaceId: string, data: unknown) =>
    ipcRenderer.invoke('canvas:create', workspaceId, data),
  update: (canvasId: string, data: unknown) => ipcRenderer.invoke('canvas:update', canvasId, data),
  updateViewport: (canvasId: string, viewport: unknown) =>
    ipcRenderer.invoke('canvas:updateViewport', canvasId, viewport),
  remove: (canvasId: string) => ipcRenderer.invoke('canvas:remove', canvasId),
  toggleLock: (canvasId: string, isLocked: boolean) =>
    ipcRenderer.invoke('canvas:toggleLock', canvasId, isLocked),
  onChanged: createOnChangedListener('canvas:changed')
}
