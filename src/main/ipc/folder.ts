import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { folderService } from '../services/folder'
import { workspaceWatcher } from '../services/workspace-watcher'
import { workspaceRepository } from '../repositories/workspace'

export function registerFolderHandlers(): void {
  ipcMain.handle('folder:readTree', (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse => {
    // watcher 활성화 (순환 의존성 방지를 위해 IPC 핸들러에서 담당)
    const workspace = workspaceRepository.findById(workspaceId)
    if (workspace) void workspaceWatcher.ensureWatching(workspaceId, workspace.path)
    return handle(() => folderService.readTree(workspaceId))
  })

  ipcMain.handle(
    'folder:create',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      parentFolderId: string | null,
      name: string
    ): IpcResponse => handle(() => folderService.create(workspaceId, parentFolderId, name))
  )

  ipcMain.handle(
    'folder:rename',
    (_: IpcMainInvokeEvent, workspaceId: string, folderId: string, newName: string): IpcResponse =>
      handle(() => folderService.rename(workspaceId, folderId, newName))
  )

  ipcMain.handle(
    'folder:remove',
    (_: IpcMainInvokeEvent, workspaceId: string, folderId: string): IpcResponse =>
      handle(() => folderService.remove(workspaceId, folderId))
  )

  ipcMain.handle(
    'folder:move',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string,
      parentFolderId: string | null,
      index: number
    ): IpcResponse => handle(() => folderService.move(workspaceId, folderId, parentFolderId, index))
  )

  ipcMain.handle(
    'folder:updateMeta',
    (
      _: IpcMainInvokeEvent,
      workspaceId: string,
      folderId: string,
      data: { color?: string | null; order?: number }
    ): IpcResponse => handle(() => folderService.updateMeta(workspaceId, folderId, data))
  )
}
