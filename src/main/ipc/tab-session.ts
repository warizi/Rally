import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { tabSessionService } from '../services/tab-session'
import type { TabSession, TabSessionInsert } from '../repositories/tab-session'

export function registerTabSessionHandlers(): void {
  ipcMain.handle(
    'tabSession:getByWorkspaceId',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => tabSessionService.getByWorkspaceId(workspaceId))
  )

  ipcMain.handle(
    'tabSession:create',
    (_: IpcMainInvokeEvent, data: Omit<TabSessionInsert, 'updatedAt'>): IpcResponse =>
      handle(() => tabSessionService.create(data))
  )

  ipcMain.handle(
    'tabSession:update',
    (_: IpcMainInvokeEvent, data: Omit<TabSession, 'updatedAt'>): IpcResponse =>
      handle(() => tabSessionService.update(data))
  )
}
