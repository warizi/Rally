import { dialog, ipcMain } from 'electron'
import { validateIpc, validateNoArgs, idSchema } from '../lib/ipc-validate'
import {
  nullableIdSchema,
  titleSchema,
  contentSchema,
  orderIndexSchema,
  booleanSchema,
  csvUpdateMetaSchema,
  externalFilePathSchema
} from './schemas'
import { csvFileService } from '../services/csv-file'

export function registerCsvFileHandlers(): void {
  ipcMain.handle(
    'csv:readByWorkspace',
    validateIpc([idSchema], (workspaceId) => csvFileService.readByWorkspaceFromDb(workspaceId))
  )

  ipcMain.handle(
    'csv:create',
    validateIpc([idSchema, nullableIdSchema, titleSchema] as const, (workspaceId, folderId, name) =>
      csvFileService.create(workspaceId, folderId, name)
    )
  )

  ipcMain.handle(
    'csv:rename',
    validateIpc([idSchema, idSchema, titleSchema] as const, (workspaceId, csvId, newName) =>
      csvFileService.rename(workspaceId, csvId, newName)
    )
  )

  ipcMain.handle(
    'csv:remove',
    validateIpc([idSchema, idSchema] as const, (workspaceId, csvId) =>
      csvFileService.remove(workspaceId, csvId)
    )
  )

  ipcMain.handle(
    'csv:readContent',
    validateIpc([idSchema, idSchema] as const, (workspaceId, csvId) =>
      csvFileService.readContent(workspaceId, csvId)
    )
  )

  ipcMain.handle(
    'csv:writeContent',
    validateIpc([idSchema, idSchema, contentSchema] as const, (workspaceId, csvId, content) =>
      csvFileService.writeContent(workspaceId, csvId, content)
    )
  )

  ipcMain.handle(
    'csv:move',
    validateIpc(
      [idSchema, idSchema, nullableIdSchema, orderIndexSchema] as const,
      (workspaceId, csvId, folderId, index) => csvFileService.move(workspaceId, csvId, folderId, index)
    )
  )

  ipcMain.handle(
    'csv:updateMeta',
    validateIpc(
      [idSchema, idSchema, csvUpdateMetaSchema] as const,
      (workspaceId, csvId, data) => csvFileService.updateMeta(workspaceId, csvId, data)
    )
  )

  ipcMain.handle(
    'csv:duplicate',
    validateIpc([idSchema, idSchema] as const, (workspaceId, csvId) =>
      csvFileService.duplicate(workspaceId, csvId)
    )
  )

  // 위험 입력: 렌더러가 넘긴 소스 경로로 파일 읽기 → path traversal 차단.
  ipcMain.handle(
    'csv:import',
    validateIpc(
      [idSchema, nullableIdSchema, externalFilePathSchema] as const,
      (workspaceId, folderId, sourcePath) =>
        csvFileService.import(workspaceId, folderId, sourcePath)
    )
  )

  ipcMain.handle(
    'csv:toggleLock',
    validateIpc(
      [idSchema, idSchema, booleanSchema] as const,
      (workspaceId, csvId, isLocked) => csvFileService.toggleLock(workspaceId, csvId, isLocked)
    )
  )

  ipcMain.handle(
    'csv:selectFile',
    validateNoArgs(async (): Promise<string[] | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      return result.canceled ? null : result.filePaths
    })
  )
}
