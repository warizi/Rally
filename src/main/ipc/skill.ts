import { ipcMain } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { validateIpc, validateIpcAsync, validateNoArgs, idSchema } from '../lib/ipc-validate'
import { skillCreateSchema, skillUpdateSchema, skillTargetSchema } from './schemas'
import { skillService } from '../services/skill'
import { skillSyncService } from '../services/skill-sync'
import { skillExportService } from '../services/skill-export'
import { trashService } from '../services/trash'

export function registerSkillHandlers(): void {
  ipcMain.handle(
    'skill:list',
    validateNoArgs((): IpcResponse => handle(() => skillService.list()))
  )

  ipcMain.handle(
    'skill:get',
    validateIpc([idSchema], (id) => skillService.get(id))
  )

  ipcMain.handle(
    'skill:create',
    validateIpc([skillCreateSchema], (input) => skillService.create(input))
  )

  ipcMain.handle(
    'skill:update',
    validateIpc([idSchema, skillUpdateSchema] as const, (id, input) => {
      const updated = skillService.update(id, input)
      // 수정 시점에 적용돼 있던 파일(claude/codex)은 새 내용이 반영 안 되어 stale 이므로
      // 모든 타겟에서 해제 → UI 도 적용됨 배지 제거. 새 내용 적용은 "적용" 버튼 재클릭.
      skillSyncService.unapplyStale(id)
      return updated
    })
  )

  ipcMain.handle(
    'skill:remove',
    validateIpc([idSchema, idSchema] as const, (workspaceId, id) => {
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
    validateIpc([idSchema], (id) => {
      const reset = skillService.resetSystem(id)
      // 리셋도 적용 파일을 stale 로 만들므로 모든 타겟에서 자동 해제.
      skillSyncService.unapplyStale(id)
      return reset
    })
  )

  ipcMain.handle(
    'skill:apply',
    validateIpc([idSchema, skillTargetSchema.default('claude')] as const, (id, target) =>
      skillSyncService.apply(id, target)
    )
  )

  ipcMain.handle(
    'skill:unapply',
    validateIpc([idSchema, skillTargetSchema.default('claude')] as const, (id, target) =>
      skillSyncService.unapply(id, target)
    )
  )

  ipcMain.handle(
    'skill:status',
    validateNoArgs((): IpcResponse => handle(() => skillSyncService.status()))
  )

  ipcMain.handle(
    'skill:export',
    validateIpcAsync([idSchema], (id) => skillExportService.exportWithDialog(id))
  )
}
