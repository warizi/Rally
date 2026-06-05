import { dialog, ipcMain } from 'electron'
import { validateIpc, validateNoArgs, idSchema } from '../lib/ipc-validate'
import {
  nullableIdSchema,
  titleSchema,
  contentSchema,
  orderIndexSchema,
  booleanSchema,
  descriptionMetaSchema,
  externalFilePathSchema
} from './schemas'
import { noteService } from '../services/note'

export function registerNoteHandlers(): void {
  ipcMain.handle(
    'note:readByWorkspace',
    validateIpc([idSchema], (workspaceId) => noteService.readByWorkspaceFromDb(workspaceId))
  )

  ipcMain.handle(
    'note:create',
    validateIpc([idSchema, nullableIdSchema, titleSchema] as const, (workspaceId, folderId, name) =>
      noteService.create(workspaceId, folderId, name)
    )
  )

  ipcMain.handle(
    'note:rename',
    validateIpc([idSchema, idSchema, titleSchema] as const, (workspaceId, noteId, newName) =>
      noteService.rename(workspaceId, noteId, newName)
    )
  )

  ipcMain.handle(
    'note:remove',
    validateIpc([idSchema, idSchema] as const, (workspaceId, noteId) =>
      noteService.remove(workspaceId, noteId)
    )
  )

  ipcMain.handle(
    'note:readContent',
    validateIpc([idSchema, idSchema] as const, (workspaceId, noteId) =>
      noteService.readContent(workspaceId, noteId)
    )
  )

  ipcMain.handle(
    'note:writeContent',
    validateIpc(
      [idSchema, idSchema, contentSchema] as const,
      (workspaceId, noteId, content) => noteService.writeContent(workspaceId, noteId, content)
    )
  )

  ipcMain.handle(
    'note:move',
    validateIpc(
      [idSchema, idSchema, nullableIdSchema, orderIndexSchema] as const,
      (workspaceId, noteId, folderId, index) =>
        noteService.move(workspaceId, noteId, folderId, index)
    )
  )

  ipcMain.handle(
    'note:updateMeta',
    validateIpc(
      [idSchema, idSchema, descriptionMetaSchema] as const,
      (workspaceId, noteId, data) => noteService.updateMeta(workspaceId, noteId, data)
    )
  )

  ipcMain.handle(
    'note:duplicate',
    validateIpc([idSchema, idSchema] as const, (workspaceId, noteId) =>
      noteService.duplicate(workspaceId, noteId)
    )
  )

  // 위험 입력: 렌더러가 넘긴 소스 경로로 파일 읽기 → path traversal 차단.
  ipcMain.handle(
    'note:import',
    validateIpc(
      [idSchema, nullableIdSchema, externalFilePathSchema] as const,
      (workspaceId, folderId, sourcePath) => noteService.import(workspaceId, folderId, sourcePath)
    )
  )

  ipcMain.handle(
    'note:toggleLock',
    validateIpc(
      [idSchema, idSchema, booleanSchema] as const,
      (workspaceId, noteId, isLocked) => noteService.toggleLock(workspaceId, noteId, isLocked)
    )
  )

  ipcMain.handle(
    'note:selectFile',
    validateNoArgs(async (): Promise<string[] | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      })
      return result.canceled ? null : result.filePaths
    })
  )
}
