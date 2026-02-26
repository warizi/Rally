import { ipcMain, IpcMainInvokeEvent, dialog } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { workspaceService } from '../services/workspace'
import type { WorkspaceUpdate } from '../repositories/workspace'
import { handle } from '../lib/handle'
import { workspaceWatcher } from '../services/workspace-watcher'

export function registerWorkspaceHandlers(): void {
  ipcMain.handle('workspace:getAll', (): IpcResponse => handle(() => workspaceService.getAll()))

  ipcMain.handle(
    'workspace:getById',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => workspaceService.getById(id))
  )

  ipcMain.handle(
    'workspace:create',
    (_: IpcMainInvokeEvent, name: string, path: string): IpcResponse =>
      handle(() => workspaceService.create(name, path))
  )

  ipcMain.handle(
    'workspace:update',
    (_: IpcMainInvokeEvent, id: string, data: WorkspaceUpdate): IpcResponse =>
      handle(() => {
        const updated = workspaceService.update(id, data)
        // path가 변경된 경우 watcher 재시작 (fire-and-forget)
        // ensureWatching이 activeWorkspacePath와 비교하므로 path 미변경 시 no-op
        if (data.path !== undefined && updated) {
          void workspaceWatcher.ensureWatching(id, updated.path)
        }
        return updated
      })
  )

  ipcMain.handle(
    'workspace:delete',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => workspaceService.delete(id))
  )

  ipcMain.handle('workspace:selectDirectory', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    return canceled ? null : filePaths[0]
  })
}
