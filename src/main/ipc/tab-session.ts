import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { tabSessionUpsertSchema } from './schemas'
import { tabSessionService } from '../services/tab-session'

export function registerTabSessionHandlers(): void {
  ipcMain.handle(
    'tabSession:getByWorkspaceId',
    validateIpc([idSchema], (workspaceId) => tabSessionService.getByWorkspaceId(workspaceId))
  )

  ipcMain.handle(
    'tabSession:upsert',
    validateIpc([tabSessionUpsertSchema], (data) => tabSessionService.upsert(data))
  )
}
