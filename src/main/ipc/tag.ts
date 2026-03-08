import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { tagService } from '../services/tag'
import type { CreateTagInput, UpdateTagInput } from '../services/tag'

export function registerTagHandlers(): void {
  ipcMain.handle(
    'tag:getAll',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => tagService.getAll(workspaceId))
  )

  ipcMain.handle(
    'tag:create',
    (_: IpcMainInvokeEvent, workspaceId: string, input: CreateTagInput): IpcResponse =>
      handle(() => tagService.create(workspaceId, input))
  )

  ipcMain.handle(
    'tag:update',
    (_: IpcMainInvokeEvent, id: string, input: UpdateTagInput): IpcResponse =>
      handle(() => tagService.update(id, input))
  )

  ipcMain.handle(
    'tag:remove',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => tagService.remove(id))
  )
}
