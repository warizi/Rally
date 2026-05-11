import { ipcRenderer } from 'electron'

export const appInfoApi = {
  getVersion: () => ipcRenderer.invoke('appInfo:getVersion'),
  getMcpServerPath: () => ipcRenderer.invoke('appInfo:getMcpServerPath'),
  getCommandFiles: () => ipcRenderer.invoke('appInfo:getCommandFiles'),
  getSkillFiles: () => ipcRenderer.invoke('appInfo:getSkillFiles')
}
