import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle, handleAsync } from '../lib/handle'
import {
  skillService,
  type CreateCustomSkillInput,
  type UpdateCustomSkillInput
} from '../services/skill'
import { skillSyncService, type SkillTarget } from '../services/skill-sync'
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
      handle(() => {
        const updated = skillService.update(id, input)
        // 수정 시점에 적용돼 있던 파일(claude/codex)은 새 내용이 반영 안 되어 stale 이므로
        // 모든 타겟에서 해제 → UI 도 적용됨 배지 제거. 새 내용 적용은 "적용" 버튼 재클릭.
        skillSyncService.unapplyStale(id)
        return updated
      })
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
    (_: IpcMainInvokeEvent, id: string): IpcResponse =>
      handle(() => {
        const reset = skillService.resetSystem(id)
        // 리셋도 적용 파일을 stale 로 만들므로 모든 타겟에서 자동 해제.
        skillSyncService.unapplyStale(id)
        return reset
      })
  )

  ipcMain.handle(
    'skill:apply',
    (_: IpcMainInvokeEvent, id: string, target: SkillTarget = 'claude'): IpcResponse =>
      handle(() => skillSyncService.apply(id, target))
  )

  ipcMain.handle(
    'skill:unapply',
    (_: IpcMainInvokeEvent, id: string, target: SkillTarget = 'claude'): IpcResponse =>
      handle(() => skillSyncService.unapply(id, target))
  )

  ipcMain.handle('skill:status', (): IpcResponse => handle(() => skillSyncService.status()))

  ipcMain.handle(
    'skill:export',
    (_: IpcMainInvokeEvent, id: string): Promise<IpcResponse> =>
      handleAsync(() => skillExportService.exportWithDialog(id))
  )
}
