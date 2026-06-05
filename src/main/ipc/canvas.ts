import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import {
  canvasFindOptionsSchema,
  canvasCreateSchema,
  canvasUpdateSchema,
  canvasViewportSchema,
  booleanSchema
} from './schemas'
import { canvasService } from '../services/canvas'

export function registerCanvasHandlers(): void {
  ipcMain.handle(
    'canvas:findByWorkspace',
    validateIpc([idSchema, canvasFindOptionsSchema] as const, (workspaceId, options) =>
      canvasService.findByWorkspace(workspaceId, options?.search)
    )
  )

  ipcMain.handle(
    'canvas:findById',
    validateIpc([idSchema], (canvasId) => canvasService.findById(canvasId))
  )

  ipcMain.handle(
    'canvas:create',
    validateIpc([idSchema, canvasCreateSchema] as const, (workspaceId, data) =>
      canvasService.create(workspaceId, data)
    )
  )

  ipcMain.handle(
    'canvas:update',
    validateIpc([idSchema, canvasUpdateSchema] as const, (canvasId, data) =>
      canvasService.update(canvasId, data)
    )
  )

  ipcMain.handle(
    'canvas:updateViewport',
    validateIpc([idSchema, canvasViewportSchema] as const, (canvasId, viewport) =>
      canvasService.updateViewport(canvasId, viewport)
    )
  )

  ipcMain.handle(
    'canvas:remove',
    validateIpc([idSchema], (canvasId) => canvasService.remove(canvasId))
  )

  ipcMain.handle(
    'canvas:toggleLock',
    validateIpc([idSchema, booleanSchema] as const, (canvasId, isLocked) =>
      canvasService.toggleLock(canvasId, isLocked)
    )
  )
}
