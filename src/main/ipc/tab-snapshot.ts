import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { tabSnapshotService } from '../services/tab-snapshot'

type CreateInput = {
  name: string
  description?: string
  workspaceId: string
  tabsJson: string
  panesJson: string
  layoutJson: string
}

type UpdateInput = {
  name?: string
  description?: string
  tabsJson?: string
  panesJson?: string
  layoutJson?: string
}

export function registerTabSnapshotHandlers(): void {
  ipcMain.handle(
    'tabSnapshot:getByWorkspaceId',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => tabSnapshotService.getByWorkspaceId(workspaceId))
  )

  ipcMain.handle(
    'tabSnapshot:create',
    (_: IpcMainInvokeEvent, data: CreateInput): IpcResponse =>
      handle(() => tabSnapshotService.create(data))
  )

  ipcMain.handle(
    'tabSnapshot:update',
    (_: IpcMainInvokeEvent, id: string, data: UpdateInput): IpcResponse =>
      handle(() => tabSnapshotService.update(id, data))
  )

  ipcMain.handle(
    'tabSnapshot:delete',
    (_: IpcMainInvokeEvent, id: string): IpcResponse =>
      handle(() => tabSnapshotService.delete(id))
  )
}
