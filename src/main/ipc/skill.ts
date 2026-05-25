import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle, handleAsync } from '../lib/handle'
import {
  skillService,
  type CreateCustomSkillInput,
  type UpdateCustomSkillInput
} from '../services/skill'
import { skillSyncService } from '../services/skill-sync'
import { skillExportService } from '../services/skill-export'

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:list', (): IpcResponse => handle(() => skillService.list()))

  ipcMain.handle(
    'skill:get',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillService.get(id))
  )

  ipcMain.handle(
    'skill:create',
    (_: IpcMainInvokeEvent, input: CreateCustomSkillInput): IpcResponse =>
      handle(() => skillService.create(input))
  )

  ipcMain.handle(
    'skill:update',
    (_: IpcMainInvokeEvent, id: string, input: UpdateCustomSkillInput): IpcResponse =>
      handle(() => skillService.update(id, input))
  )

  ipcMain.handle(
    'skill:remove',
    (_: IpcMainInvokeEvent, id: string): IpcResponse =>
      handle(() =>
        // 커스텀 skill 삭제 시 ~/.claude/skills 의 적용 파일도 함께 정리.
        // 이름 조회 → DB 삭제 → 파일 정리 순서 (이름 조회 실패 시 IPC 가 NotFoundError 반환).
        {
          const item = skillService.get(id)
          skillService.remove(id)
          skillSyncService.cleanupByName(item.name)
        }
      )
  )

  ipcMain.handle(
    'skill:apply',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillSyncService.apply(id))
  )

  ipcMain.handle(
    'skill:unapply',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillSyncService.unapply(id))
  )

  ipcMain.handle('skill:status', (): IpcResponse => handle(() => skillSyncService.status()))

  ipcMain.handle(
    'skill:export',
    (_: IpcMainInvokeEvent, id: string): Promise<IpcResponse> =>
      handleAsync(() => skillExportService.exportWithDialog(id))
  )
}
