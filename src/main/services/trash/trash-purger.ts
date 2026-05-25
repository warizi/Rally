import { and, eq, lt } from 'drizzle-orm'
import { db } from '../../db'
import {
  trashBatches,
  todos,
  schedules,
  recurringRules,
  canvases,
  canvasNodes,
  canvasEdges,
  canvasGroups,
  notes,
  csvFiles,
  pdfFiles,
  imageFiles,
  folders,
  templates,
  customSkills
} from '../../db/schema'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { workspaceRepository } from '../../repositories/workspace'
import { appSettingsRepository } from '../../repositories/app-settings'
import { withTransaction } from '../../lib/transaction'

import {
  type TrashRetentionKey,
  RETENTION_DAYS,
  SETTINGS_KEY,
  DEFAULT_RETENTION,
  isValidRetention
} from './types'
import { broadcastTrashChanged, purgeTrashDir } from './helpers'

/**
 * 휴지통 영구 삭제 / 만료 정리.
 *
 *   - `purge(batchId)`: 단일 batch hard delete + FS 디렉토리 제거
 *   - `sweep(workspaceId, cutoffMs)`: 워크스페이스 내 만료 batch 일괄 purge
 *   - `sweepAll()`: retention 설정 기반 전 워크스페이스 sweep
 *   - retention getter/setter (앱 설정 저장)
 */
export const trashPurger = {
  /** batch 영구 삭제 — DB row hard delete (cascade FK 가 자식까지 정리) + FS trash 디렉토리 제거 */
  purge(batchId: string): void {
    const batch = db.select().from(trashBatches).where(eq(trashBatches.id, batchId)).get()
    if (!batch) throw new NotFoundError(`Trash batch not found: ${batchId}`)
    const fsPath = batch.fsTrashPath
    const purgedWorkspaceId = batch.workspaceId

    withTransaction(() => {
      // 자식 row 를 먼저 hard delete (FK 가 cascade 라 부모만 지워도 되지만 명시적으로)
      db.delete(canvasEdges).where(eq(canvasEdges.trashBatchId, batchId)).run()
      db.delete(canvasNodes).where(eq(canvasNodes.trashBatchId, batchId)).run()
      db.delete(canvasGroups).where(eq(canvasGroups.trashBatchId, batchId)).run()
      db.delete(canvases).where(eq(canvases.trashBatchId, batchId)).run()
      db.delete(todos).where(eq(todos.trashBatchId, batchId)).run()
      db.delete(schedules).where(eq(schedules.trashBatchId, batchId)).run()
      db.delete(recurringRules).where(eq(recurringRules.trashBatchId, batchId)).run()
      db.delete(notes).where(eq(notes.trashBatchId, batchId)).run()
      db.delete(csvFiles).where(eq(csvFiles.trashBatchId, batchId)).run()
      db.delete(pdfFiles).where(eq(pdfFiles.trashBatchId, batchId)).run()
      db.delete(imageFiles).where(eq(imageFiles.trashBatchId, batchId)).run()
      db.delete(folders).where(eq(folders.trashBatchId, batchId)).run()
      db.delete(templates).where(eq(templates.trashBatchId, batchId)).run()
      db.delete(customSkills).where(eq(customSkills.trashBatchId, batchId)).run()

      db.delete(trashBatches).where(eq(trashBatches.id, batchId)).run()
    })

    // FS trash 디렉토리 제거 (트랜잭션 외부 — rollback 불가능하므로)
    purgeTrashDir(fsPath)
    broadcastTrashChanged(purgedWorkspaceId)
  },

  /**
   * deletedAt < (now - cutoffMs) 인 batch 모두 purge.
   * @returns purge 된 batch 수
   */
  sweep(workspaceId: string, cutoffMs: number): number {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    if (cutoffMs < 0) throw new ValidationError('cutoffMs must be >= 0')

    const cutoff = new Date(Date.now() - cutoffMs)
    const oldBatches = db
      .select({ id: trashBatches.id })
      .from(trashBatches)
      .where(and(eq(trashBatches.workspaceId, workspaceId), lt(trashBatches.deletedAt, cutoff)))
      .all()

    for (const { id } of oldBatches) {
      this.purge(id)
    }
    return oldBatches.length
  },

  // ─── 자동 비우기 설정 ────────────────────────────────────────

  getRetention(): TrashRetentionKey {
    const raw = appSettingsRepository.get(SETTINGS_KEY)
    if (raw && isValidRetention(raw)) return raw
    return DEFAULT_RETENTION
  },

  setRetention(value: TrashRetentionKey): void {
    if (!isValidRetention(value)) {
      throw new ValidationError(
        `Invalid retention: ${value}. Must be one of ${Object.keys(RETENTION_DAYS).join(', ')}.`
      )
    }
    appSettingsRepository.set(SETTINGS_KEY, value)
  },

  /**
   * 모든 워크스페이스에 대해 retention 설정에 맞춰 sweep.
   * 'never' 설정이면 0 반환하고 아무것도 하지 않음.
   * @returns 전체 purge 된 batch 수
   */
  sweepAll(): number {
    const retention = this.getRetention()
    const days = RETENTION_DAYS[retention]
    if (days === null) return 0 // never

    const cutoffMs = days * 24 * 60 * 60 * 1000
    const allWs = db.select({ id: trashBatches.workspaceId }).from(trashBatches).all()
    const wsIds = Array.from(new Set(allWs.map((r) => r.id)))
    let totalPurged = 0
    for (const wsId of wsIds) {
      try {
        totalPurged += this.sweep(wsId, cutoffMs)
      } catch {
        // 워크스페이스 단위 실패는 다른 워크스페이스 sweep 을 막지 않음
      }
    }
    return totalPurged
  }
}
