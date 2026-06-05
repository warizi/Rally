import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { validateIpc, idSchema } from '../lib/ipc-validate'
import { externalFilePathSchema, relativeFilePathSchema } from './schemas'
import { noteImageService } from '../services/note-image'

export function registerNoteImageHandlers(): void {
  // 위험 입력: 렌더러가 넘긴 소스 경로로 파일을 읽어 복사 → path traversal 차단.
  ipcMain.handle(
    'noteImage:saveFromPath',
    validateIpc([idSchema, externalFilePathSchema], (workspaceId, sourcePath) =>
      noteImageService.saveFromPath(workspaceId, sourcePath)
    )
  )

  ipcMain.handle(
    'noteImage:saveFromBuffer',
    (_: IpcMainInvokeEvent, workspaceId: string, buffer: ArrayBuffer, ext: string): IpcResponse =>
      handle(() => noteImageService.saveFromBuffer(workspaceId, buffer, ext))
  )

  // 위험 입력: 워크스페이스 내부 상대 경로로 파일 읽기 → path traversal 차단.
  ipcMain.handle(
    'noteImage:readImage',
    validateIpc([idSchema, relativeFilePathSchema], (workspaceId, relativePath) =>
      noteImageService.readImage(workspaceId, relativePath)
    )
  )
}
