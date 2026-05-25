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
import { trashService } from '../services/trash'

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
    (_: IpcMainInvokeEvent, workspaceId: string, id: string): IpcResponse =>
      handle(() => {
        // 1. 도메인 검증 (system 차단, not-found 차단) + name 회수
        const { name } = skillService.ensureCustomDeletable(id)
        // 2. trash 시스템에 위임 — trash_batches row 생성 + deletedAt/trashBatchId 세팅
        const batchId = trashService.softRemove(workspaceId, 'custom_skill', id)
        // 3. 적용된 ~/.claude/skills/<name>/ 디렉터리 정리 (복구 시 재적용 필요)
        skillSyncService.cleanupByName(name)
        return { batchId }
      })
  )

  ipcMain.handle(
    'skill:resetSystem',
    (_: IpcMainInvokeEvent, id: string): IpcResponse => handle(() => skillService.resetSystem(id))
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
