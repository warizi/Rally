import { ipcMain } from 'electron'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { nullableIdSchema, titleSchema, orderIndexSchema, folderUpdateMetaSchema } from './schemas'
import { folderService } from '../services/folder'
import { workspaceWatcher } from '../services/workspace-watcher'
import { workspaceRepository } from '../repositories/workspace'

export function registerFolderHandlers(): void {
  ipcMain.handle(
    'folder:readTree',
    validateIpc([idSchema], (workspaceId) => {
      // watcher 활성화 — 백그라운드에서 fs 스캔 + DB 동기화 후 'folder:changed' push
      const workspace = workspaceRepository.findById(workspaceId)
      if (workspace) void workspaceWatcher.ensureWatching(workspaceId, workspace.path)
      // DB만 읽어 즉시 반환 — 메인 스레드 블로킹 없음
      return folderService.readTreeFromDb(workspaceId)
    })
  )

  ipcMain.handle(
    'folder:create',
    validateIpc(
      [idSchema, nullableIdSchema, titleSchema] as const,
      (workspaceId, parentFolderId, name) => folderService.create(workspaceId, parentFolderId, name)
    )
  )

  ipcMain.handle(
    'folder:rename',
    validateIpc([idSchema, idSchema, titleSchema] as const, (workspaceId, folderId, newName) =>
      folderService.rename(workspaceId, folderId, newName)
    )
  )

  ipcMain.handle(
    'folder:remove',
    validateIpc([idSchema, idSchema] as const, (workspaceId, folderId) =>
      folderService.remove(workspaceId, folderId)
    )
  )

  ipcMain.handle(
    'folder:move',
    validateIpc(
      [idSchema, idSchema, nullableIdSchema, orderIndexSchema] as const,
      (workspaceId, folderId, parentFolderId, index) =>
        folderService.move(workspaceId, folderId, parentFolderId, index)
    )
  )

  ipcMain.handle(
    'folder:updateMeta',
    validateIpc(
      [idSchema, idSchema, folderUpdateMetaSchema] as const,
      (workspaceId, folderId, data) => folderService.updateMeta(workspaceId, folderId, data)
    )
  )
}
