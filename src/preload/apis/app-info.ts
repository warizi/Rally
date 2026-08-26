import { ipcRenderer } from 'electron'

export const appInfoApi = {
  getVersion: () => ipcRenderer.invoke('appInfo:getVersion'),
  getMcpServerPath: () => ipcRenderer.invoke('appInfo:getMcpServerPath'),
  getCommandFiles: () => ipcRenderer.invoke('appInfo:getCommandFiles'),
  getSkillFiles: () => ipcRenderer.invoke('appInfo:getSkillFiles'),
  // M-5: 오류 화면에서 로그 파일 위치 열기
  openLogFolder: () => ipcRenderer.invoke('appInfo:openLogFolder')
}
