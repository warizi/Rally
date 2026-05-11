import { ipcRenderer } from 'electron'
import { createOnChangedListener } from '../lib/on-changed-listener'

export const todoApi = {
  findByWorkspace: (workspaceId: string, options?: { filter?: 'all' | 'active' | 'completed' }) =>
    ipcRenderer.invoke('todo:findByWorkspace', workspaceId, options),
  findByDateRange: (workspaceId: string, range: { start: Date; end: Date }) =>
    ipcRenderer.invoke('todo:findByDateRange', workspaceId, range),
  create: (workspaceId: string, data: unknown) =>
    ipcRenderer.invoke('todo:create', workspaceId, data),
  update: (todoId: string, data: unknown) => ipcRenderer.invoke('todo:update', todoId, data),
  remove: (todoId: string) => ipcRenderer.invoke('todo:remove', todoId),
  reorderList: (workspaceId: string, updates: unknown[]) =>
    ipcRenderer.invoke('todo:reorderList', workspaceId, updates),
  reorderKanban: (workspaceId: string, updates: unknown[]) =>
    ipcRenderer.invoke('todo:reorderKanban', workspaceId, updates),
  reorderSub: (parentId: string, updates: unknown[]) =>
    ipcRenderer.invoke('todo:reorderSub', parentId, updates),
  findCompletedWithRecurring: (workspaceId: string) =>
    ipcRenderer.invoke('todo:findCompletedWithRecurring', workspaceId),
  onChanged: createOnChangedListener('todo:changed')
}
