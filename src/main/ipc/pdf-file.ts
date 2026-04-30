import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { pdfFileService } from '../services/pdf-file'

export function registerPdfFileHandlers(): void {
  ipcMain.handle(
    'pdf:readByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => pdfFileService.readByWorkspaceFromDb(workspaceId))
  )

  ipcMain.handle(
    'pdf:import',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      sourcePath: string
    ): IpcResponse => handle(() => pdfFileService.import(workspaceId, folderId, sourcePath))
  )

  ipcMain.handle(
    'pdf:duplicate',
    (_: IpcMainInvokeEvent, workspaceId: string, pdfId: string): IpcResponse =>
      handle(() => pdfFileService.duplicate(workspaceId, pdfId))
  )

  ipcMain.handle(
    'pdf:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, pdfId: string, newName: string): IpcResponse =>
      handle(() => pdfFileService.rename(workspaceId, pdfId, newName))
  )

  ipcMain.handle(
    'pdf:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, pdfId: string): IpcResponse =>
      handle(() => pdfFileService.remove(workspaceId, pdfId))
  )

  ipcMain.handle(
    'pdf:readContent',
    (_: IpcMainInvokeEvent, workspaceId: string, pdfId: string): IpcResponse =>
      handle(() => pdfFileService.readContent(workspaceId, pdfId))
  )

  ipcMain.handle(
    'pdf:move',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      pdfId: string,
      folderId: string | null,
      index: number
    ): IpcResponse => handle(() => pdfFileService.move(workspaceId, pdfId, folderId, index))
  )

  ipcMain.handle(
    'pdf:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      pdfId: string,
      data: { description?: string }
    ): IpcResponse => handle(() => pdfFileService.updateMeta(workspaceId, pdfId, data))
  )

  ipcMain.handle('pdf:selectFile', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
