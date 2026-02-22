import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { workspaceService } from '../services/workspace'
import type { WorkspaceUpdate } from '../repositories/workspace'
import { handle } from '../lib/handle'

export function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspace:getAll', (): IpcResponse => handle(() => workspaceService.getAll()))

  ipcMain.handle(
    'workspace:getById',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => workspaceService.getById(id))
  )

  ipcMain.handle(
    'workspace:create',
    (_: IpcMainInvokeEvent, name: string): IpcResponse =>
      handle(() => workspaceService.create(name))
  )

  ipcMain.handle(
    'workspace:update',
    (_: IpcMainInvokeEvent, id: string, data: WorkspaceUpdate): IpcResponse =>
      handle(() => workspaceService.update(id, data))
  )

  ipcMain.handle(
    'workspace:delete',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => workspaceService.delete(id))
  )
}
