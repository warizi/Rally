import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { dateSchema } from './schemas'
import { recurringCompletionService } from '../services/recurring-completion'

export function registerRecurringCompletionHandlers(): void {
  ipcMain.handle(
    'recurringCompletion:complete',
    validateIpc([idSchema, dateSchema] as const, (ruleId, date) =>
      recurringCompletionService.complete(ruleId, new Date(date))
    )
  )

  ipcMain.handle(
    'recurringCompletion:uncomplete',
    validateIpc([idSchema], (completionId) =>
      recurringCompletionService.uncomplete(completionId)
    )
  )

  ipcMain.handle(
    'recurringCompletion:findTodayByWorkspace',
    validateIpc([idSchema, dateSchema] as const, (workspaceId, date) =>
      recurringCompletionService.findTodayByWorkspace(workspaceId, new Date(date))
    )
  )
}
