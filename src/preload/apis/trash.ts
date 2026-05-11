import { ipcRenderer } from 'electron'

export const trashApi = {
  list: (
    workspaceId: string,
    options?: {
      types?: string[]
      search?: string
      offset?: number
      limit?: number
    }
  ) => ipcRenderer.invoke('trash:list', workspaceId, options),
  count: (workspaceId: string) => ipcRenderer.invoke('trash:count', workspaceId),
  restore: (workspaceId: string, batchId: string) =>
    ipcRenderer.invoke('trash:restore', workspaceId, batchId),
  purge: (workspaceId: string, batchId: string) =>
    ipcRenderer.invoke('trash:purge', workspaceId, batchId),
  emptyAll: (workspaceId: string) => ipcRenderer.invoke('trash:emptyAll', workspaceId),
  softRemove: (workspaceId: string, entityType: string, entityId: string) =>
    ipcRenderer.invoke('trash:softRemove', workspaceId, entityType, entityId),
  getRetention: () => ipcRenderer.invoke('trash:getRetention'),
  setRetention: (value: string) => ipcRenderer.invoke('trash:setRetention', value),
  sweepNow: () => ipcRenderer.invoke('trash:sweepNow'),
  onChanged: (cb: (workspaceId: string) => void): (() => void) => {
    const handler = (_event: unknown, workspaceId: string): void => cb(workspaceId)
    ipcRenderer.on('trash:changed', handler)
    return () => ipcRenderer.removeListener('trash:changed', handler)
  }
}
