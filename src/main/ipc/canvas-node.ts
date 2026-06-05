import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import {
  canvasNodeCreateSchema,
  canvasNodeUpdateSchema,
  canvasNodePositionsSchema,
  canvasSyncStateSchema
} from './schemas'
import { canvasNodeService } from '../services/canvas-node'

export function registerCanvasNodeHandlers(): void {
  ipcMain.handle(
    'canvasNode:findByCanvas',
    validateIpc([idSchema], (canvasId) => canvasNodeService.findByCanvas(canvasId))
  )

  ipcMain.handle(
    'canvasNode:create',
    validateIpc([idSchema, canvasNodeCreateSchema] as const, (canvasId, data) =>
      canvasNodeService.create(canvasId, data)
    )
  )

  ipcMain.handle(
    'canvasNode:update',
    validateIpc([idSchema, canvasNodeUpdateSchema] as const, (nodeId, data) =>
      canvasNodeService.update(nodeId, data)
    )
  )

  ipcMain.handle(
    'canvasNode:updatePositions',
    validateIpc([canvasNodePositionsSchema], (updates) =>
      canvasNodeService.updatePositions(updates)
    )
  )

  ipcMain.handle(
    'canvasNode:remove',
    validateIpc([idSchema], (nodeId) => canvasNodeService.remove(nodeId))
  )

  ipcMain.handle(
    'canvasNode:syncState',
    validateIpc([idSchema, canvasSyncStateSchema] as const, (canvasId, data) => {
      canvasNodeService.syncState(
        canvasId,
        data.nodes as Parameters<typeof canvasNodeService.syncState>[1],
        data.edges as Parameters<typeof canvasNodeService.syncState>[2],
        (data.groups ?? []) as Parameters<typeof canvasNodeService.syncState>[3]
      )
    })
  )
}
