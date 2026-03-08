import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { folderService } from '../services/folder'
import { workspaceWatcher } from '../services/workspace-watcher'
import { workspaceRepository } from '../repositories/workspace'

export function registerFolderHandlers(): void {
  ipcMain.handle('folder:readTree', (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse => {
    // watcher 활성화 — 백그라운드에서 fs 스캔 + DB 동기화 후 'folder:changed' push
    const workspace = workspaceRepository.findById(workspaceId)
    if (workspace) void workspaceWatcher.ensureWatching(workspaceId, workspace.path)
    // DB만 읽어 즉시 반환 — 메인 스레드 블로킹 없음
    return handle(() => folderService.readTreeFromDb(workspaceId))
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
