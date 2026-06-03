import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { canvasGroupService } from '../services/canvas-group'
import type { CreateCanvasGroupData, UpdateCanvasGroupData } from '../services/canvas-group'

export function registerCanvasGroupHandlers(): void {
  ipcMain.handle(
    'canvasGroup:findByCanvas',
    (_: IpcMainInvokeEvent, canvasId: string): IpcResponse =>
      handle(() => canvasGroupService.findByCanvas(canvasId))
  )

  ipcMain.handle(
    'canvasGroup:create',
    (_: IpcMainInvokeEvent, canvasId: string, data: unknown): IpcResponse =>
      handle(() => canvasGroupService.create(canvasId, data as CreateCanvasGroupData))
  )

  ipcMain.handle(
    'canvasGroup:update',
    (_: IpcMainInvokeEvent, groupId: string, data: unknown): IpcResponse =>
      handle(() => canvasGroupService.update(groupId, data as UpdateCanvasGroupData))
  )

  ipcMain.handle(
    'canvasGroup:remove',
    (_: IpcMainInvokeEvent, groupId: string): IpcResponse =>
      handle(() => canvasGroupService.remove(groupId))
  )
}
