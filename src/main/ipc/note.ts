import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { noteService } from '../services/note'

export function registerNoteHandlers(): void {
  ipcMain.handle(
    'note:readByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => noteService.readByWorkspaceFromDb(workspaceId))
  )

  ipcMain.handle(
    'note:create',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      name: string
    ): IpcResponse => handle(() => noteService.create(workspaceId, folderId, name))
  )

  ipcMain.handle(
    'note:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, noteId: string, newName: string): IpcResponse =>
      handle(() => noteService.rename(workspaceId, noteId, newName))
  )

  ipcMain.handle(
    'note:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, noteId: string): IpcResponse =>
      handle(() => noteService.remove(workspaceId, noteId))
  )

  ipcMain.handle(
    'note:readContent',
    (_: IpcMainInvokeEvent, workspaceId: string, noteId: string): IpcResponse =>
      handle(() => noteService.readContent(workspaceId, noteId))
  )

  ipcMain.handle(
    'note:writeContent',
    (_: IpcMainInvokeEvent, workspaceId: string, noteId: string, content: string): IpcResponse =>
      handle(() => noteService.writeContent(workspaceId, noteId, content))
  )

  ipcMain.handle(
    'note:move',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      noteId: string,
      folderId: string | null,
      index: number
    ): IpcResponse => handle(() => noteService.move(workspaceId, noteId, folderId, index))
  )

  ipcMain.handle(
    'note:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      noteId: string,
      data: { description?: string }
    ): IpcResponse => handle(() => noteService.updateMeta(workspaceId, noteId, data))
  )

  ipcMain.handle(
    'note:duplicate',
    (_: IpcMainInvokeEvent, workspaceId: string, noteId: string): IpcResponse =>
      handle(() => noteService.duplicate(workspaceId, noteId))
  )

  ipcMain.handle(
    'note:import',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string | null,
      sourcePath: string
    ): IpcResponse => handle(() => noteService.import(workspaceId, folderId, sourcePath))
  )

  ipcMain.handle('note:selectFile', async (): Promise<string[] | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    return result.canceled ? null : result.filePaths
  })
}
