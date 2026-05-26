import { ipcRenderer } from 'electron'

interface WatcherActor {
  kind: 'user' | 'ai'
  id: string | null
}

export function createOnChangedListener(channel: string) {
  return (
    callback: (
      workspaceId: string,
      changedRelPaths: string[],
      actor: WatcherActor | null
    ) => void
  ) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      workspaceId: string,
      changedRelPaths: string[],
      actor: WatcherActor | null
    ): void => callback(workspaceId, changedRelPaths, actor ?? null)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}
