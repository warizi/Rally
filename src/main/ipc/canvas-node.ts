import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { canvasNodeService } from '../services/canvas-node'
import type { CreateCanvasNodeData, UpdateCanvasNodeData } from '../services/canvas-node'

export function registerCanvasNodeHandlers(): void {
  ipcMain.handle(
    'canvasNode:findByCanvas',
    (_: IpcMainInvokeEvent, canvasId: string): IpcResponse =>
      handle(() => canvasNodeService.findByCanvas(canvasId))
  )

  ipcMain.handle(
    'canvasNode:create',
    (_: IpcMainInvokeEvent, canvasId: string, data: unknown): IpcResponse =>
      handle(() => canvasNodeService.create(canvasId, data as CreateCanvasNodeData))
  )

  ipcMain.handle(
    'canvasNode:update',
    (_: IpcMainInvokeEvent, nodeId: string, data: unknown): IpcResponse =>
      handle(() => canvasNodeService.update(nodeId, data as UpdateCanvasNodeData))
  )

  ipcMain.handle(
    'canvasNode:updatePositions',
    (_: IpcMainInvokeEvent, updates: unknown): IpcResponse =>
      handle(() =>
        canvasNodeService.updatePositions(updates as { id: string; x: number; y: number }[])
      )
  )

  ipcMain.handle(
    'canvasNode:remove',
    (_: IpcMainInvokeEvent, nodeId: string): IpcResponse =>
      handle(() => canvasNodeService.remove(nodeId))
  )
}
