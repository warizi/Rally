import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { tabSnapshotCreateSchema, tabSnapshotUpdateSchema } from './schemas'
import { tabSnapshotService } from '../services/tab-snapshot'

export function registerTabSnapshotHandlers(): void {
  ipcMain.handle(
    'tabSnapshot:getByWorkspaceId',
    validateIpc([idSchema], (workspaceId) => tabSnapshotService.getByWorkspaceId(workspaceId))
  )

  ipcMain.handle(
    'tabSnapshot:create',
    validateIpc([tabSnapshotCreateSchema], (data) => tabSnapshotService.create(data))
  )

  ipcMain.handle(
    'tabSnapshot:update',
    validateIpc([idSchema, tabSnapshotUpdateSchema] as const, (id, data) =>
      tabSnapshotService.update(id, data)
    )
  )

  ipcMain.handle(
    'tabSnapshot:delete',
    validateIpc([idSchema], (id) => tabSnapshotService.delete(id))
  )
}
