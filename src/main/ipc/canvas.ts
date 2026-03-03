import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { canvasService } from '../services/canvas'

export function registerCanvasHandlers(): void {
  ipcMain.handle(
    'canvas:findByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => canvasService.findByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'canvas:findById',
    (_: IpcMainInvokeEvent, canvasId: string): IpcResponse =>
      handle(() => canvasService.findById(canvasId))
  )

  ipcMain.handle(
    'canvas:create',
    (_: IpcMainInvokeEvent, workspaceId: string, data: unknown): IpcResponse =>
      handle(() =>
        canvasService.create(workspaceId, data as { title: string; description?: string })
      )
  )

  ipcMain.handle(
    'canvas:update',
    (_: IpcMainInvokeEvent, canvasId: string, data: unknown): IpcResponse =>
      handle(() => canvasService.update(canvasId, data as { title?: string; description?: string }))
  )

  ipcMain.handle(
    'canvas:updateViewport',
    (_: IpcMainInvokeEvent, canvasId: string, viewport: unknown): IpcResponse =>
      handle(() =>
        canvasService.updateViewport(canvasId, viewport as { x: number; y: number; zoom: number })
      )
  )

  ipcMain.handle(
    'canvas:remove',
    (_: IpcMainInvokeEvent, canvasId: string): IpcResponse =>
      handle(() => canvasService.remove(canvasId))
  )
}
