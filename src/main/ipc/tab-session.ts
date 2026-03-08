import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { tabSessionService } from '../services/tab-session'

export function registerTabSessionHandlers(): void {
  ipcMain.handle(
    'tabSession:getByWorkspaceId',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => tabSessionService.getByWorkspaceId(workspaceId))
  )

  ipcMain.handle(
    'tabSession:upsert',
    (_: IpcMainInvokeEvent, data: unknown): IpcResponse =>
      handle(() => tabSessionService.upsert(data as Parameters<typeof tabSessionService.upsert>[0]))
  )
}
