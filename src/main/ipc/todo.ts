import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import {
  createTodoSchema,
  updateTodoSchema,
  todoOrderUpdatesSchema,
  todoDateRangeSchema,
  todoFilterOptionsSchema
} from './schemas'
import { todoService } from '../services/todo'

export function registerTodoHandlers(): void {
  ipcMain.handle(
    'todo:findByWorkspace',
    validateIpc([idSchema, todoFilterOptionsSchema] as const, (workspaceId, options) =>
      todoService.findByWorkspace(workspaceId, options?.filter)
    )
  )

  ipcMain.handle(
    'todo:findByDateRange',
    validateIpc([idSchema, todoDateRangeSchema] as const, (workspaceId, range) =>
      todoService.findByWorkspaceAndDateRange(workspaceId, range)
    )
  )

  ipcMain.handle(
    'todo:create',
    validateIpc([idSchema, createTodoSchema] as const, (workspaceId, data) =>
      todoService.create(workspaceId, data)
    )
  )

  ipcMain.handle(
    'todo:update',
    validateIpc([idSchema, updateTodoSchema] as const, (todoId, data) =>
      todoService.update(todoId, data)
    )
  )

  ipcMain.handle(
    'todo:remove',
    validateIpc([idSchema], (todoId) => todoService.remove(todoId))
  )

  ipcMain.handle(
    'todo:reorderList',
    validateIpc([idSchema, todoOrderUpdatesSchema] as const, (workspaceId, updates) =>
      todoService.reorderList(workspaceId, updates)
    )
  )

  ipcMain.handle(
    'todo:reorderKanban',
    validateIpc([idSchema, todoOrderUpdatesSchema] as const, (workspaceId, updates) =>
      todoService.reorderKanban(workspaceId, updates)
    )
  )

  ipcMain.handle(
    'todo:reorderSub',
    validateIpc([idSchema, todoOrderUpdatesSchema] as const, (parentId, updates) =>
      todoService.reorderSub(parentId, updates)
    )
  )

  ipcMain.handle(
    'todo:findCompletedWithRecurring',
    validateIpc([idSchema], (workspaceId) => todoService.findCompletedWithRecurring(workspaceId))
  )
}
