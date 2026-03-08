import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { reminderService } from '../services/reminder'
import type { SetReminderData } from '../services/reminder'

export function registerReminderHandlers(): void {
  ipcMain.handle(
    'reminder:findByEntity',
    (_: IpcMainInvokeEvent, entityType: 'todo' | 'schedule', entityId: string): IpcResponse =>
      handle(() => reminderService.findByEntity(entityType, entityId))
  )

  ipcMain.handle(
    'reminder:set',
    (_: IpcMainInvokeEvent, data: SetReminderData): IpcResponse =>
      handle(() => reminderService.set(data))
  )

  ipcMain.handle(
    'reminder:remove',
    (_: IpcMainInvokeEvent, reminderId: string): IpcResponse =>
      handle(() => reminderService.remove(reminderId))
  )

  ipcMain.handle(
    'reminder:removeByEntity',
    (_: IpcMainInvokeEvent, entityType: 'todo' | 'schedule', entityId: string): IpcResponse =>
      handle(() => reminderService.removeByEntity(entityType, entityId))
  )
}
