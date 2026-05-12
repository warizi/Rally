import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { trashBatches } from '../../db/schema'
import { NotFoundError, ValidationError } from '../../lib/errors'
import { workspaceRepository } from '../../repositories/workspace'

import {
  type TrashEntityKind,
  type TrashBatchSummary,
  type TrashListOptions,
  type TrashListResult,
  type SoftRemoveOptions,
  type TrashRetentionKey
} from './types'
import { getTrashRoot } from './helpers'
import { trashCollector } from './trash-collector'
import { trashRestorer } from './trash-restorer'
import { trashPurger } from './trash-purger'
// side-effect: handler 들을 registry 에 등록 (trashService 호출 전에 반드시 import)
import './handlers'

/**
 * 휴지통 시스템 — soft delete + 복구 + 자동 정리.
 *
 * 파사드 패턴. 책임은 모듈로 위임:
 *   - `./types.ts`              — 도메인 타입 + retention 설정
 *   - `./helpers.ts`            — FS 이동, snapshot, broadcast
 *   - `./cascade-collector.ts`  — entity 별 cascade 수집 (dispatcher 만, 핸들러 우회)
 *   - `./handlers/*`            — entity 별 SoftDeleteHandler (10개)
 *   - `./trash-collector.ts`    — softRemove 트랜잭션 본문
 *   - `./trash-restorer.ts`     — restore 트랜잭션 본문
 *   - `./trash-purger.ts`       — purge / sweep / retention 관리
 *
 * 본 파일은 공개 API 만 노출.
 *
 * 설계: `기능/MCP/v2/휴지통 시스템 설계 (P4-1 상세).md`
 */

// 외부에서 사용하던 도메인 타입과 헬퍼 재노출 (backward compat)
export type {
  TrashEntityKind,
  TrashBatchSummary,
  TrashListOptions,
  TrashListResult,
  SoftRemoveOptions,
  TrashRetentionKey
}
export { getTrashRoot }

// ─── service ──────────────────────────────────────────────────

export const trashService = {
  /**
   * entity 를 휴지통으로 이동. cascade 자식은 같은 batch_id 로 묶임.
   * @returns 생성된 trash_batch_id
   */
  softRemove(
    workspaceId: string,
    entityType: TrashEntityKind,
    entityId: string,
    options: SoftRemoveOptions = {}
  ): string {
    return trashCollector.collect(workspaceId, entityType, entityId, options)
  },

  /**
   * batch 단위 복구. deletedAt = NULL 로 되돌림.
   * entity-link snapshot 은 활성 entity 에 한해 재생성.
   */
  restore(batchId: string): {
    restored: { type: TrashEntityKind; id: string; title: string }[]
    conflicts?: { id: string; reason: string }[]
  } {
    return trashRestorer.restore(batchId)
  },

  /** batch 영구 삭제 — DB row hard delete (cascade FK 가 자식까지 정리) + FS trash 디렉토리 제거 */
  purge(batchId: string): void {
    trashPurger.purge(batchId)
  },

  /** workspace 단위 휴지통 batch 목록 (최근 삭제 우선) */
  list(workspaceId: string, options: TrashListOptions = {}): TrashListResult {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    const offset = options.offset ?? 0
    const limit = options.limit ?? 50
    if (offset < 0) throw new ValidationError('offset must be >= 0')
    if (limit < 1 || limit > 200) throw new ValidationError('limit must be between 1 and 200')

    const conditions = [eq(trashBatches.workspaceId, workspaceId)]
    if (options.types && options.types.length > 0) {
      conditions.push(inArray(trashBatches.rootEntityType, options.types))
    }
    let rows = db
      .select()
      .from(trashBatches)
      .where(and(...conditions))
      .all()

    if (options.search && options.search.trim()) {
      const lower = options.search.trim().toLowerCase()
      rows = rows.filter((r) => r.rootTitle.toLowerCase().includes(lower))
    }

    rows.sort(
      (a, b) =>
        (b.deletedAt instanceof Date ? b.deletedAt.getTime() : Number(b.deletedAt)) -
        (a.deletedAt instanceof Date ? a.deletedAt.getTime() : Number(a.deletedAt))
    )

    const total = rows.length
    const sliced = rows.slice(offset, offset + limit)
    const batches: TrashBatchSummary[] = sliced.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      rootEntityType: r.rootEntityType as TrashEntityKind,
      rootEntityId: r.rootEntityId,
      rootTitle: r.rootTitle,
      childCount: r.childCount,
      deletedAt: r.deletedAt instanceof Date ? r.deletedAt : new Date(r.deletedAt),
      reason: r.reason
    }))

    return {
      batches,
      total,
      hasMore: offset + sliced.length < total,
      nextOffset: offset + sliced.length
    }
  },

  /**
   * deletedAt < (now - cutoffMs) 인 batch 모두 purge.
   * @returns purge 된 batch 수
   */
  sweep(workspaceId: string, cutoffMs: number): number {
    return trashPurger.sweep(workspaceId, cutoffMs)
  },

  /** trashBatchId 역참조 — UI 에서 단건 entity 로 batch 찾기 (예: "이거 어느 batch?"). */
  findBatchByEntity(_workspaceId: string, batchIdField: string | null): TrashBatchSummary | null {
    if (!batchIdField) return null
    const batch = db.select().from(trashBatches).where(eq(trashBatches.id, batchIdField)).get()
    if (!batch) return null
    return {
      id: batch.id,
      workspaceId: batch.workspaceId,
      rootEntityType: batch.rootEntityType as TrashEntityKind,
      rootEntityId: batch.rootEntityId,
      rootTitle: batch.rootTitle,
      childCount: batch.childCount,
      deletedAt: batch.deletedAt instanceof Date ? batch.deletedAt : new Date(batch.deletedAt),
      reason: batch.reason
    }
  },

  /** 휴지통에 있는 row 만 — UI 의 "휴지통 비어있는지?" 표시 */
  countByWorkspace(workspaceId: string): number {
    return db.select().from(trashBatches).where(eq(trashBatches.workspaceId, workspaceId)).all()
      .length
  },

  // ─── 자동 비우기 설정 + cron 헬퍼 ────────────────────────────

  getRetention(): TrashRetentionKey {
    return trashPurger.getRetention()
  },

  setRetention(value: TrashRetentionKey): void {
    trashPurger.setRetention(value)
  },

  /**
   * 모든 워크스페이스에 대해 retention 설정에 맞춰 sweep.
   * 'never' 설정이면 0 반환하고 아무것도 하지 않음.
   * @returns 전체 purge 된 batch 수
   */
  sweepAll(): number {
    return trashPurger.sweepAll()
  }
}
