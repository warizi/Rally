import { ipcRenderer } from 'electron'

export const recurringCompletionApi = {
  complete: (ruleId: string, date: Date) =>
    ipcRenderer.invoke('recurringCompletion:complete', ruleId, date),
  uncomplete: (completionId: string) =>
    ipcRenderer.invoke('recurringCompletion:uncomplete', completionId),
  findTodayByWorkspace: (workspaceId: string, date: Date) =>
    ipcRenderer.invoke('recurringCompletion:findTodayByWorkspace', workspaceId, date),
  onChanged: (callback: (workspaceId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, workspaceId: string): void =>
      callback(workspaceId)
    ipcRenderer.on('recurring-completion:changed', handler)
    return () => ipcRenderer.removeListener('recurring-completion:changed', handler)
  }
}
