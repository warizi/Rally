import { ipcRenderer } from 'electron'

export const recurringRuleApi = {
  findByWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('recurringRule:findByWorkspace', workspaceId),
  findToday: (workspaceId: string, date: Date) =>
    ipcRenderer.invoke('recurringRule:findToday', workspaceId, date),
  create: (workspaceId: string, data: unknown) =>
    ipcRenderer.invoke('recurringRule:create', workspaceId, data),
  update: (ruleId: string, data: unknown) =>
    ipcRenderer.invoke('recurringRule:update', ruleId, data),
  delete: (ruleId: string) => ipcRenderer.invoke('recurringRule:delete', ruleId),
  onChanged: (callback: (workspaceId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, workspaceId: string): void =>
      callback(workspaceId)
    ipcRenderer.on('recurring-rule:changed', handler)
    return () => ipcRenderer.removeListener('recurring-rule:changed', handler)
  }
}
