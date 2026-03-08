import { ipcMain, dialog } from 'electron'
import { handle, handleAsync } from '../lib/handle'
import { successResponse } from '../lib/ipc-response'
import { backupService } from '../services/backup'
import { workspaceService } from '../services/workspace'

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:export', async (_, workspaceId: string) => {
    const ws = workspaceService.getById(workspaceId)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `rally-backup-${ws.name}-${timestamp}.zip`,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    })
    if (canceled || !filePath) return successResponse(null)
    return handleAsync(() => backupService.export(workspaceId, filePath))
  })

  ipcMain.handle('backup:selectFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Rally Backup', extensions: ['zip'] }],
      properties: ['openFile']
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('backup:readManifest', (_, zipPath: string) =>
    handle(() => backupService.readManifest(zipPath))
  )

  ipcMain.handle('backup:import', async (_, zipPath: string, name: string, path: string) =>
    handleAsync(() => backupService.import(zipPath, name, path))
  )
}
