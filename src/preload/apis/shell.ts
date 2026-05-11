import { ipcRenderer } from 'electron'

// window.shell 로 노출되는 별도 객체 (window.api 가 아님)
export const shellApi = {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
}
