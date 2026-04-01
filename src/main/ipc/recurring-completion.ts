import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { recurringCompletionService } from '../services/recurring-completion'

export function registerRecurringCompletionHandlers(): void {
  ipcMain.handle(
    'recurringCompletion:complete',
    (_: IpcMainInvokeEvent, ruleId: string, date: Date): IpcResponse =>
      handle(() => recurringCompletionService.complete(ruleId, new Date(date)))
  )

  ipcMain.handle(
    'recurringCompletion:uncomplete',
    (_: IpcMainInvokeEvent, completionId: string): IpcResponse =>
      handle(() => recurringCompletionService.uncomplete(completionId))
  )

  ipcMain.handle(
    'recurringCompletion:findTodayByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string, date: Date): IpcResponse =>
      handle(() => recurringCompletionService.findTodayByWorkspace(workspaceId, new Date(date)))
  )
}
