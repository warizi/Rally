import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { tagCreateSchema, tagUpdateSchema } from './schemas'
import { tagService } from '../services/tag'

export function registerTagHandlers(): void {
  ipcMain.handle(
    'tag:getAll',
    validateIpc([idSchema], (workspaceId) => tagService.getAll(workspaceId))
  )

  ipcMain.handle(
    'tag:create',
    validateIpc([idSchema, tagCreateSchema] as const, (workspaceId, input) =>
      tagService.create(workspaceId, input)
    )
  )

  ipcMain.handle(
    'tag:update',
    validateIpc([idSchema, tagUpdateSchema] as const, (id, input) => tagService.update(id, input))
  )

  ipcMain.handle(
    'tag:remove',
    validateIpc([idSchema], (id) => tagService.remove(id))
  )
}
