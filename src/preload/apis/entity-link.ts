import { ipcRenderer } from 'electron'

export const entityLinkApi = {
  link: (typeA: string, idA: string, typeB: string, idB: string, workspaceId: string) =>
    ipcRenderer.invoke('entityLink:link', typeA, idA, typeB, idB, workspaceId),
  unlink: (typeA: string, idA: string, typeB: string, idB: string) =>
    ipcRenderer.invoke('entityLink:unlink', typeA, idA, typeB, idB),
  getLinked: (entityType: string, entityId: string) =>
    ipcRenderer.invoke('entityLink:getLinked', entityType, entityId),
  onChanged: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('entity-link:changed', handler)
    return () => ipcRenderer.removeListener('entity-link:changed', handler)
  }
}
