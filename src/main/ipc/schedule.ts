import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { scheduleService } from '../services/schedule'
import type { CreateScheduleData, UpdateScheduleData, ScheduleDateRange } from '../services/schedule'

export function registerScheduleHandlers(): void {
  ipcMain.handle(
    'schedule:findAllByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => scheduleService.findAllByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'schedule:findByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string, range: ScheduleDateRange): IpcResponse =>
      handle(() => scheduleService.findByWorkspace(workspaceId, range))
  )

  ipcMain.handle(
    'schedule:findById',
    (_: IpcMainInvokeEvent, scheduleId: string): IpcResponse =>
      handle(() => scheduleService.findById(scheduleId))
  )

  ipcMain.handle(
    'schedule:create',
    (_: IpcMainInvokeEvent, workspaceId: string, data: CreateScheduleData): IpcResponse =>
      handle(() => scheduleService.create(workspaceId, data))
  )

  ipcMain.handle(
    'schedule:update',
    (_: IpcMainInvokeEvent, scheduleId: string, data: UpdateScheduleData): IpcResponse =>
      handle(() => scheduleService.update(scheduleId, data))
  )

  ipcMain.handle(
    'schedule:remove',
    (_: IpcMainInvokeEvent, scheduleId: string): IpcResponse =>
      handle(() => scheduleService.remove(scheduleId))
  )

  ipcMain.handle(
    'schedule:move',
    (_: IpcMainInvokeEvent, scheduleId: string, startAt: Date, endAt: Date): IpcResponse =>
      handle(() => scheduleService.move(scheduleId, startAt, endAt))
  )

  ipcMain.handle(
    'schedule:linkTodo',
    (_: IpcMainInvokeEvent, scheduleId: string, todoId: string): IpcResponse =>
      handle(() => scheduleService.linkTodo(scheduleId, todoId))
  )

  ipcMain.handle(
    'schedule:unlinkTodo',
    (_: IpcMainInvokeEvent, scheduleId: string, todoId: string): IpcResponse =>
      handle(() => scheduleService.unlinkTodo(scheduleId, todoId))
  )

  ipcMain.handle(
    'schedule:getLinkedTodos',
    (_: IpcMainInvokeEvent, scheduleId: string): IpcResponse =>
      handle(() => scheduleService.getLinkedTodos(scheduleId))
  )
}
