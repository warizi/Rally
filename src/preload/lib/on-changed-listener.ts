import { ipcRenderer } from 'electron'

export function createOnChangedListener(channel: string) {
  return (callback: (workspaceId: string, changedRelPaths: string[]) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      workspaceId: string,
      changedRelPaths: string[]
    ): void => callback(workspaceId, changedRelPaths)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}
