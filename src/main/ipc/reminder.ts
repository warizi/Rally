import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { reminderEntityTypeSchema, reminderSetSchema } from './schemas'
import { reminderService } from '../services/reminder'

export function registerReminderHandlers(): void {
  ipcMain.handle(
    'reminder:findByEntity',
    validateIpc([reminderEntityTypeSchema, idSchema] as const, (entityType, entityId) =>
      reminderService.findByEntity(entityType, entityId)
    )
  )

  ipcMain.handle(
    'reminder:set',
    validateIpc([reminderSetSchema], (data) => reminderService.set(data))
  )

  ipcMain.handle(
    'reminder:remove',
    validateIpc([idSchema], (reminderId) => reminderService.remove(reminderId))
  )

  ipcMain.handle(
    'reminder:removeByEntity',
    validateIpc([reminderEntityTypeSchema, idSchema] as const, (entityType, entityId) =>
      reminderService.removeByEntity(entityType, entityId)
    )
  )
}
