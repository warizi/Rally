import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { canvasGroupCreateSchema, canvasGroupUpdateSchema } from './schemas'
import { canvasGroupService } from '../services/canvas-group'

export function registerCanvasGroupHandlers(): void {
  ipcMain.handle(
    'canvasGroup:findByCanvas',
    validateIpc([idSchema], (canvasId) => canvasGroupService.findByCanvas(canvasId))
  )

  ipcMain.handle(
    'canvasGroup:create',
    validateIpc([idSchema, canvasGroupCreateSchema] as const, (canvasId, data) =>
      canvasGroupService.create(canvasId, data)
    )
  )

  ipcMain.handle(
    'canvasGroup:update',
    validateIpc([idSchema, canvasGroupUpdateSchema] as const, (groupId, data) =>
      canvasGroupService.update(groupId, data)
    )
  )

  ipcMain.handle(
    'canvasGroup:remove',
    validateIpc([idSchema], (groupId) => canvasGroupService.remove(groupId))
  )
}
