import { dialog, ipcMain } from 'electron'
import { validateIpc, validateNoArgs, idSchema } from '../lib/ipc-validate'
import {
  nullableIdSchema,
  titleSchema,
  orderIndexSchema,
  descriptionMetaSchema,
  externalFilePathSchema
} from './schemas'
import { imageFileService } from '../services/image-file'

export function registerImageFileHandlers(): void {
  ipcMain.handle(
    'image:readByWorkspace',
    validateIpc([idSchema], (workspaceId) => imageFileService.readByWorkspaceFromDb(workspaceId))
  )

  // 위험 입력: 렌더러가 넘긴 소스 경로로 파일 읽기 → path traversal 차단.
  ipcMain.handle(
    'image:import',
    validateIpc(
      [idSchema, nullableIdSchema, externalFilePathSchema] as const,
      (workspaceId, folderId, sourcePath) =>
        imageFileService.import(workspaceId, folderId, sourcePath)
    )
  )

  ipcMain.handle(
    'image:duplicate',
    validateIpc([idSchema, idSchema] as const, (workspaceId, imageId) =>
      imageFileService.duplicate(workspaceId, imageId)
    )
  )

  ipcMain.handle(
    'image:rename',
    validateIpc([idSchema, idSchema, titleSchema] as const, (workspaceId, imageId, newName) =>
      imageFileService.rename(workspaceId, imageId, newName)
    )
  )

  ipcMain.handle(
    'image:remove',
    validateIpc([idSchema, idSchema] as const, (workspaceId, imageId) =>
      imageFileService.remove(workspaceId, imageId)
    )
  )

  ipcMain.handle(
    'image:readContent',
    validateIpc([idSchema, idSchema] as const, (workspaceId, imageId) =>
      imageFileService.readContent(workspaceId, imageId)
    )
  )

  ipcMain.handle(
    'image:move',
    validateIpc(
      [idSchema, idSchema, nullableIdSchema, orderIndexSchema] as const,
      (workspaceId, imageId, folderId, index) =>
        imageFileService.move(workspaceId, imageId, folderId, index)
    )
  )

  ipcMain.handle(
    'image:updateMeta',
    validateIpc(
      [idSchema, idSchema, descriptionMetaSchema] as const,
      (workspaceId, imageId, data) => imageFileService.updateMeta(workspaceId, imageId, data)
    )
  )

  ipcMain.handle(
    'image:selectFile',
    validateNoArgs(async (): Promise<string[] | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }
        ]
      })
      return result.canceled ? null : result.filePaths
    })
  )
}
