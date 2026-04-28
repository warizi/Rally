import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { csvFileService } from '../services/csv-file'

export function registerCsvFileHandlers(): void {
  ipcMain.handle(
    'csv:readByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => csvFileService.readByWorkspaceFromDb(workspaceId))
  )

  ipcMain.handle(
    'csv:create',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      name: string
    ): IpcResponse => handle(() => csvFileService.create(workspaceId, folderId, name))
  )

  ipcMain.handle(
    'csv:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, csvId: string, newName: string): IpcResponse =>
      handle(() => csvFileService.rename(workspaceId, csvId, newName))
  )

  ipcMain.handle(
    'csv:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, csvId: string): IpcResponse =>
      handle(() => csvFileService.remove(workspaceId, csvId))
  )

  ipcMain.handle(
    'csv:readContent',
    (_: IpcMainInvokeEvent, workspaceId: string, csvId: string): IpcResponse =>
      handle(() => csvFileService.readContent(workspaceId, csvId))
  )

  ipcMain.handle(
    'csv:writeContent',
    (_: IpcMainInvokeEvent, workspaceId: string, csvId: string, content: string): IpcResponse =>
      handle(() => csvFileService.writeContent(workspaceId, csvId, content))
  )

  ipcMain.handle(
    'csv:move',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      csvId: string,
      folderId: string | null,
      index: number
    ): IpcResponse => handle(() => csvFileService.move(workspaceId, csvId, folderId, index))
  )

  ipcMain.handle(
    'csv:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      csvId: string,
      data: { description?: string; columnWidths?: string }
    ): IpcResponse => handle(() => csvFileService.updateMeta(workspaceId, csvId, data))
  )

  ipcMain.handle(
    'csv:import',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      sourcePath: string
    ): IpcResponse => handle(() => csvFileService.import(workspaceId, folderId, sourcePath))
  )

  ipcMain.handle('csv:selectFile', async (): Promise<string[] | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    return result.canceled ? null : result.filePaths
  })
}
