import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { historyService, type HistoryFetchOptions } from '../services/history'

export function registerHistoryHandlers(): void {
  ipcMain.handle(
    'history:fetch',
    (_: IpcMainInvokeEvent, workspaceId: string, options?: HistoryFetchOptions): IpcResponse =>
      handle(() => historyService.fetch(workspaceId, options ?? {}))
  )
}
