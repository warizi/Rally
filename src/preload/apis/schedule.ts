import { ipcRenderer } from 'electron'

export const scheduleApi = {
  findAllByWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('schedule:findAllByWorkspace', workspaceId),
  findByWorkspace: (workspaceId: string, range: unknown) =>
    ipcRenderer.invoke('schedule:findByWorkspace', workspaceId, range),
  findById: (scheduleId: string) => ipcRenderer.invoke('schedule:findById', scheduleId),
  create: (workspaceId: string, data: unknown) =>
    ipcRenderer.invoke('schedule:create', workspaceId, data),
  update: (scheduleId: string, data: unknown) =>
    ipcRenderer.invoke('schedule:update', scheduleId, data),
  remove: (scheduleId: string) => ipcRenderer.invoke('schedule:remove', scheduleId),
  move: (scheduleId: string, startAt: unknown, endAt: unknown) =>
    ipcRenderer.invoke('schedule:move', scheduleId, startAt, endAt),
  linkTodo: (scheduleId: string, todoId: string) =>
    ipcRenderer.invoke('schedule:linkTodo', scheduleId, todoId),
  unlinkTodo: (scheduleId: string, todoId: string) =>
    ipcRenderer.invoke('schedule:unlinkTodo', scheduleId, todoId),
  getLinkedTodos: (scheduleId: string) => ipcRenderer.invoke('schedule:getLinkedTodos', scheduleId)
}
