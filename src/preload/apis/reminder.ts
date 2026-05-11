import { ipcRenderer } from 'electron'

export const reminderApi = {
  findByEntity: (entityType: string, entityId: string) =>
    ipcRenderer.invoke('reminder:findByEntity', entityType, entityId),
  set: (data: unknown) => ipcRenderer.invoke('reminder:set', data),
  remove: (reminderId: string) => ipcRenderer.invoke('reminder:remove', reminderId),
  removeByEntity: (entityType: string, entityId: string) =>
    ipcRenderer.invoke('reminder:removeByEntity', entityType, entityId),
  onFired: (callback: (data: { entityType: string; entityId: string; title: string }) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      data: { entityType: string; entityId: string; title: string }
    ): void => callback(data)
    ipcRenderer.on('reminder:fired', handler)
    return () => ipcRenderer.removeListener('reminder:fired', handler)
  }
}
