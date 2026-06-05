import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import {
  dateSchema,
  scheduleDateRangeSchema,
  scheduleCreateSchema,
  scheduleUpdateSchema
} from './schemas'
import { scheduleService } from '../services/schedule'

export function registerScheduleHandlers(): void {
  ipcMain.handle(
    'schedule:findAllByWorkspace',
    validateIpc([idSchema], (workspaceId) => scheduleService.findAllByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'schedule:findByWorkspace',
    validateIpc([idSchema, scheduleDateRangeSchema] as const, (workspaceId, range) =>
      scheduleService.findByWorkspace(workspaceId, range)
    )
  )

  ipcMain.handle(
    'schedule:findById',
    validateIpc([idSchema], (scheduleId) => scheduleService.findById(scheduleId))
  )

  ipcMain.handle(
    'schedule:create',
    validateIpc([idSchema, scheduleCreateSchema] as const, (workspaceId, data) =>
      scheduleService.create(workspaceId, data)
    )
  )

  ipcMain.handle(
    'schedule:update',
    validateIpc([idSchema, scheduleUpdateSchema] as const, (scheduleId, data) =>
      scheduleService.update(scheduleId, data)
    )
  )

  ipcMain.handle(
    'schedule:remove',
    validateIpc([idSchema], (scheduleId) => scheduleService.remove(scheduleId))
  )

  ipcMain.handle(
    'schedule:move',
    validateIpc([idSchema, dateSchema, dateSchema] as const, (scheduleId, startAt, endAt) =>
      scheduleService.move(scheduleId, startAt, endAt)
    )
  )

  ipcMain.handle(
    'schedule:linkTodo',
    validateIpc([idSchema, idSchema] as const, (scheduleId, todoId) =>
      scheduleService.linkTodo(scheduleId, todoId)
    )
  )

  ipcMain.handle(
    'schedule:unlinkTodo',
    validateIpc([idSchema, idSchema] as const, (scheduleId, todoId) =>
      scheduleService.unlinkTodo(scheduleId, todoId)
    )
  )

  ipcMain.handle(
    'schedule:getLinkedTodos',
    validateIpc([idSchema], (scheduleId) => scheduleService.getLinkedTodos(scheduleId))
  )
}
