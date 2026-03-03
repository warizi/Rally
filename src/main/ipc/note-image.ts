import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { noteImageService } from '../services/note-image'

export function registerNoteImageHandlers(): void {
  ipcMain.handle(
    'noteImage:saveFromPath',
    (_: IpcMainInvokeEvent, workspaceId: string, sourcePath: string): IpcResponse =>
      handle(() => noteImageService.saveFromPath(workspaceId, sourcePath))
  )

  ipcMain.handle(
    'noteImage:saveFromBuffer',
    (_: IpcMainInvokeEvent, workspaceId: string, buffer: ArrayBuffer, ext: string): IpcResponse =>
      handle(() => noteImageService.saveFromBuffer(workspaceId, buffer, ext))
  )

  ipcMain.handle(
    'noteImage:readImage',
    (_: IpcMainInvokeEvent, workspaceId: string, relativePath: string): IpcResponse =>
      handle(() => noteImageService.readImage(workspaceId, relativePath))
  )
}
