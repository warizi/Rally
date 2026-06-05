import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { templateTypeSchema, templateCreateSchema } from './schemas'
import { templateService } from '../services/template'

export function registerTemplateHandlers(): void {
  ipcMain.handle(
    'template:list',
    validateIpc([idSchema, templateTypeSchema] as const, (workspaceId, type) =>
      templateService.list(workspaceId, type)
    )
  )

  ipcMain.handle(
    'template:create',
    validateIpc([templateCreateSchema], (input) => templateService.create(input))
  )

  ipcMain.handle(
    'template:delete',
    validateIpc([idSchema], (id) => templateService.delete(id))
  )
}
