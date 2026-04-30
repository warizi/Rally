import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { imageFileService } from '../services/image-file'

export function registerImageFileHandlers(): void {
  ipcMain.handle(
    'image:readByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => imageFileService.readByWorkspaceFromDb(workspaceId))
  )

  ipcMain.handle(
    'image:import',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      sourcePath: string
    ): IpcResponse => handle(() => imageFileService.import(workspaceId, folderId, sourcePath))
  )

  ipcMain.handle(
    'image:duplicate',
    (_: IpcMainInvokeEvent, workspaceId: string, imageId: string): IpcResponse =>
      handle(() => imageFileService.duplicate(workspaceId, imageId))
  )

  ipcMain.handle(
    'image:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, imageId: string, newName: string): IpcResponse =>
      handle(() => imageFileService.rename(workspaceId, imageId, newName))
  )

  ipcMain.handle(
    'image:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, imageId: string): IpcResponse =>
      handle(() => imageFileService.remove(workspaceId, imageId))
  )

  ipcMain.handle(
    'image:readContent',
    (_: IpcMainInvokeEvent, workspaceId: string, imageId: string): IpcResponse =>
      handle(() => imageFileService.readContent(workspaceId, imageId))
  )

  ipcMain.handle(
    'image:move',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      imageId: string,
      folderId: string | null,
      index: number
    ): IpcResponse => handle(() => imageFileService.move(workspaceId, imageId, folderId, index))
  )

  ipcMain.handle(
    'image:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      imageId: string,
      data: { description?: string }
    ): IpcResponse => handle(() => imageFileService.updateMeta(workspaceId, imageId, data))
  )

  ipcMain.handle('image:selectFile', async (): Promise<string[] | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }]
    })
    return result.canceled ? null : result.filePaths
  })
}
