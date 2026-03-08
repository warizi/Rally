import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { todoService } from '../services/todo'
import type { CreateTodoData, UpdateTodoData, TodoOrderUpdate } from '../services/todo'

export function registerTodoHandlers(): void {
  ipcMain.handle(
    'todo:findByWorkspace',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      options?: { filter?: 'all' | 'active' | 'completed' }
    ): IpcResponse => handle(() => todoService.findByWorkspace(workspaceId, options?.filter))
  )

  ipcMain.handle(
    'todo:findByDateRange',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      range: { start: Date; end: Date }
    ): IpcResponse =>
      handle(() => todoService.findByWorkspaceAndDateRange(workspaceId, range))
  )

  ipcMain.handle(
    'todo:create',
    (_: IpcMainInvokeEvent, workspaceId: string, data: CreateTodoData): IpcResponse =>
      handle(() => todoService.create(workspaceId, data))
  )

  ipcMain.handle(
    'todo:update',
    (_: IpcMainInvokeEvent, todoId: string, data: UpdateTodoData): IpcResponse =>
      handle(() => todoService.update(todoId, data))
  )

  ipcMain.handle(
    'todo:remove',
    (_: IpcMainInvokeEvent, todoId: string): IpcResponse => handle(() => todoService.remove(todoId))
  )

  ipcMain.handle(
    'todo:reorderList',
    (_: IpcMainInvokeEvent, workspaceId: string, updates: TodoOrderUpdate[]): IpcResponse =>
      handle(() => todoService.reorderList(workspaceId, updates))
  )

  ipcMain.handle(
    'todo:reorderKanban',
    (_: IpcMainInvokeEvent, workspaceId: string, updates: TodoOrderUpdate[]): IpcResponse =>
      handle(() => todoService.reorderKanban(workspaceId, updates))
  )

  ipcMain.handle(
    'todo:reorderSub',
    (_: IpcMainInvokeEvent, parentId: string, updates: TodoOrderUpdate[]): IpcResponse =>
      handle(() => todoService.reorderSub(parentId, updates))
  )
}
