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

type SkillTarget = 'claude' | 'codex'

export const skillApi = {
  list: () => ipcRenderer.invoke('skill:list'),
  get: (id: string) => ipcRenderer.invoke('skill:get', id),
  create: (input: CreateCustomSkillInput) => ipcRenderer.invoke('skill:create', input),
  update: (id: string, input: UpdateCustomSkillInput) =>
    ipcRenderer.invoke('skill:update', id, input),
  remove: (workspaceId: string, id: string) => ipcRenderer.invoke('skill:remove', workspaceId, id),
  resetSystem: (id: string) => ipcRenderer.invoke('skill:resetSystem', id),
  apply: (id: string, target: SkillTarget = 'claude') =>
    ipcRenderer.invoke('skill:apply', id, target),
  unapply: (id: string, target: SkillTarget = 'claude') =>
    ipcRenderer.invoke('skill:unapply', id, target),
  status: () => ipcRenderer.invoke('skill:status'),
  export: (id: string) => ipcRenderer.invoke('skill:export', id)
}
