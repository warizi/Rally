import { ipcRenderer } from 'electron'

export const noteStyleTemplateApi = {
  list: () => ipcRenderer.invoke('noteStyleTemplate:list'),
  create: (input: { name: string; settingsJson: string }) =>
    ipcRenderer.invoke('noteStyleTemplate:create', input),
  remove: (id: string) => ipcRenderer.invoke('noteStyleTemplate:remove', id)
}
