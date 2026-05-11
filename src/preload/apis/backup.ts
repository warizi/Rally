import { ipcRenderer } from 'electron'

export const backupApi = {
  export: (workspaceId: string) => ipcRenderer.invoke('backup:export', workspaceId),
  selectFile: () => ipcRenderer.invoke('backup:selectFile'),
  readManifest: (zipPath: string) => ipcRenderer.invoke('backup:readManifest', zipPath),
  import: (zipPath: string, name: string, path: string) =>
    ipcRenderer.invoke('backup:import', zipPath, name, path)
}
