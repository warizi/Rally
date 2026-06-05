import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { historyFetchOptionsSchema } from './schemas'
import { historyService } from '../services/history'

export function registerHistoryHandlers(): void {
  ipcMain.handle(
    'history:fetch',
    validateIpc([idSchema, historyFetchOptionsSchema] as const, (workspaceId, options) =>
      historyService.fetch(workspaceId, options ?? {})
    )
  )
}
