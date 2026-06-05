import { dialog, ipcMain } from 'electron'
import { validateIpc, validateNoArgs, idSchema } from '../lib/ipc-validate'
import {
  nullableIdSchema,
  titleSchema,
  orderIndexSchema,
  descriptionMetaSchema,
  externalFilePathSchema
} from './schemas'
import { pdfFileService } from '../services/pdf-file'

export function registerPdfFileHandlers(): void {
  ipcMain.handle(
    'pdf:readByWorkspace',
    validateIpc([idSchema], (workspaceId) => pdfFileService.readByWorkspaceFromDb(workspaceId))
  )

  // 위험 입력: 렌더러가 넘긴 소스 경로로 파일 읽기 → path traversal 차단.
  ipcMain.handle(
    'pdf:import',
    validateIpc(
      [idSchema, nullableIdSchema, externalFilePathSchema] as const,
      (workspaceId, folderId, sourcePath) =>
        pdfFileService.import(workspaceId, folderId, sourcePath)
    )
  )

  ipcMain.handle(
    'pdf:duplicate',
    validateIpc([idSchema, idSchema] as const, (workspaceId, pdfId) =>
      pdfFileService.duplicate(workspaceId, pdfId)
    )
  )

  ipcMain.handle(
    'pdf:rename',
    validateIpc([idSchema, idSchema, titleSchema] as const, (workspaceId, pdfId, newName) =>
      pdfFileService.rename(workspaceId, pdfId, newName)
    )
  )

  ipcMain.handle(
    'pdf:remove',
    validateIpc([idSchema, idSchema] as const, (workspaceId, pdfId) =>
      pdfFileService.remove(workspaceId, pdfId)
    )
  )

  ipcMain.handle(
    'pdf:readContent',
    validateIpc([idSchema, idSchema] as const, (workspaceId, pdfId) =>
      pdfFileService.readContent(workspaceId, pdfId)
    )
  )

  ipcMain.handle(
    'pdf:move',
    validateIpc(
      [idSchema, idSchema, nullableIdSchema, orderIndexSchema] as const,
      (workspaceId, pdfId, folderId, index) =>
        pdfFileService.move(workspaceId, pdfId, folderId, index)
    )
  )

  ipcMain.handle(
    'pdf:updateMeta',
    validateIpc([idSchema, idSchema, descriptionMetaSchema] as const, (workspaceId, pdfId, data) =>
      pdfFileService.updateMeta(workspaceId, pdfId, data)
    )
  )

  ipcMain.handle(
    'pdf:selectFile',
    validateNoArgs(async (): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      return result.canceled ? null : result.filePaths[0]
    })
  )
}
