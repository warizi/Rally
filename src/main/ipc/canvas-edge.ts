import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { canvasEdgeService } from '../services/canvas-edge'
import type { CreateCanvasEdgeData, UpdateCanvasEdgeData } from '../services/canvas-edge'

export function registerCanvasEdgeHandlers(): void {
  ipcMain.handle(
    'canvasEdge:findByCanvas',
    (_: IpcMainInvokeEvent, canvasId: string): IpcResponse =>
      handle(() => canvasEdgeService.findByCanvas(canvasId))
  )

  ipcMain.handle(
    'canvasEdge:create',
    (_: IpcMainInvokeEvent, canvasId: string, data: unknown): IpcResponse =>
      handle(() => canvasEdgeService.create(canvasId, data as CreateCanvasEdgeData))
  )

  ipcMain.handle(
    'canvasEdge:update',
    (_: IpcMainInvokeEvent, edgeId: string, data: unknown): IpcResponse =>
      handle(() => canvasEdgeService.update(edgeId, data as UpdateCanvasEdgeData))
  )

  ipcMain.handle(
    'canvasEdge:remove',
    (_: IpcMainInvokeEvent, edgeId: string): IpcResponse =>
      handle(() => canvasEdgeService.remove(edgeId))
  )
}
