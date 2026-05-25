import { ipcRenderer } from 'electron'

export interface CreateCustomSkillInput {
  name: string
  description: string
  content: string
  mcpTools?: string[]
  triggers?: string[]
}

export interface UpdateCustomSkillInput {
  description?: string
  content?: string
  mcpTools?: string[]
  triggers?: string[]
}

export const skillApi = {
  list: () => ipcRenderer.invoke('skill:list'),
  get: (id: string) => ipcRenderer.invoke('skill:get', id),
  create: (input: CreateCustomSkillInput) => ipcRenderer.invoke('skill:create', input),
  update: (id: string, input: UpdateCustomSkillInput) =>
    ipcRenderer.invoke('skill:update', id, input),
  remove: (id: string) => ipcRenderer.invoke('skill:remove', id),
  apply: (id: string) => ipcRenderer.invoke('skill:apply', id),
  unapply: (id: string) => ipcRenderer.invoke('skill:unapply', id),
  status: () => ipcRenderer.invoke('skill:status')
}
