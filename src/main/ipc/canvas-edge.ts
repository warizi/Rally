import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { canvasEdgeCreateSchema, canvasEdgeUpdateSchema } from './schemas'
import { canvasEdgeService } from '../services/canvas-edge'

export function registerCanvasEdgeHandlers(): void {
  ipcMain.handle(
    'canvasEdge:findByCanvas',
    validateIpc([idSchema], (canvasId) => canvasEdgeService.findByCanvas(canvasId))
  )

  ipcMain.handle(
    'canvasEdge:create',
    validateIpc([idSchema, canvasEdgeCreateSchema] as const, (canvasId, data) =>
      canvasEdgeService.create(canvasId, data)
    )
  )

  ipcMain.handle(
    'canvasEdge:update',
    validateIpc([idSchema, canvasEdgeUpdateSchema] as const, (edgeId, data) =>
      canvasEdgeService.update(edgeId, data)
    )
  )

  ipcMain.handle(
    'canvasEdge:remove',
    validateIpc([idSchema], (edgeId) => canvasEdgeService.remove(edgeId))
  )
}
