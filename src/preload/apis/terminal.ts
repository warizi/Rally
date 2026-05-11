import { ipcRenderer } from 'electron'
import { terminalDataListeners, terminalExitListeners } from '../lib/terminal-listeners'

export const terminalApi = {
  // id?: 복원 시 기존 DB 세션 ID 전달, 신규 탭 시 생략
  // sortOrder?: 신규 탭 순서 (복원 시 불필요)
  create: (args: {
    workspaceId: string
    cwd: string
    shell?: string
    cols: number
    rows: number
    id?: string
    sortOrder?: number
  }) => ipcRenderer.invoke('terminal:create', args),
  destroy: (id: string) => ipcRenderer.invoke('terminal:destroy', id),
  destroyAll: (workspaceId: string) => ipcRenderer.invoke('terminal:destroyAll', workspaceId),
  write: (args: { id: string; data: string }) => ipcRenderer.send('terminal:write', args),
  resize: (args: { id: string; cols: number; rows: number }) =>
    ipcRenderer.send('terminal:resize', args),
  saveSnapshot: (id: string, snapshot: string) =>
    ipcRenderer.invoke('terminal:saveSnapshot', id, snapshot),
  onData: (id: string, cb: (d: { data: string }) => void) => {
    terminalDataListeners.set(id, cb)
    return () => terminalDataListeners.delete(id)
  },
  onExit: (id: string, cb: (d: { exitCode: number }) => void) => {
    terminalExitListeners.set(id, cb)
    return () => terminalExitListeners.delete(id)
  },
  getSessions: (workspaceId: string) => ipcRenderer.invoke('terminal:getSessions', workspaceId),
  getLayout: (workspaceId: string) => ipcRenderer.invoke('terminal:getLayout', workspaceId),
  updateSession: (id: string, data: unknown) =>
    ipcRenderer.invoke('terminal:updateSession', id, data),
  saveLayout: (workspaceId: string, layoutJson: string) =>
    ipcRenderer.invoke('terminal:saveLayout', workspaceId, layoutJson),
  closeSession: (id: string) => ipcRenderer.invoke('terminal:closeSession', id)
}
