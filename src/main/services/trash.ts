import { app } from 'electron'
import path from 'path'
import { NotFoundError } from '../lib/errors'

/**
 * 휴지통 시스템 — soft delete + 복구 + 자동 정리.
 *
 * **이 파일은 P4-1 M1 단계 골격(스켈레톤)이다.**
 * 실제 동작 (softRemove / restore / purge / list / sweep) 구현은 후속 슬라이스에서
 * 도메인별로 채워 넣는다 — 우선 인터페이스만 고정해 호출자가 미리 의존하지 않도록 throw.
 *
 * 설계 노트: `기능/MCP/v2/휴지통 시스템 설계 (P4-1 상세).md`
 */

export type TrashEntityKind =
  | 'folder'
  | 'note'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'canvas'
  | 'todo'
  | 'schedule'
  | 'recurring_rule'

export interface TrashBatchSummary {
  id: string
  workspaceId: string
  rootEntityType: TrashEntityKind
  rootEntityId: string
  rootTitle: string
  childCount: number
  deletedAt: Date
  reason: string | null
}

export interface TrashListOptions {
  /** 종류 필터 */
  types?: TrashEntityKind[]
  /** root_title LIKE 검색 */
  search?: string
  offset?: number
  limit?: number
}

export interface TrashListResult {
  batches: TrashBatchSummary[]
  total: number
  hasMore: boolean
  nextOffset: number
}

export interface SoftRemoveOptions {
  reason?: 'user_action' | 'mcp' | 'auto_sweep_pending'
}

/**
 * 휴지통 FS 디렉토리 루트.
 * `<userData>/trash/<wsId>/<batchId>/...` 구조.
 * workspace 폴더 밖에 두어 workspace-watcher의 reconcile 로직과 충돌하지 않게 격리.
 */
export function getTrashRoot(workspaceId: string): string {
  // app.getPath()는 main process에서만 호출 가능. 테스트 환경에선 fallback 사용.
  let userData: string
  try {
    userData = app.getPath('userData')
  } catch {
    userData = path.join(process.cwd(), '.rally-test-userdata')
  }
  return path.join(userData, 'trash', workspaceId)
}

function notImplemented(method: string, ...args: unknown[]): never {
  // args는 향후 구현 시 처리됨 — eslint unused 회피용으로 void만
  void args
  throw new NotFoundError(
    `trashService.${method} is not implemented yet. P4-1 다음 슬라이스에서 채워질 예정.`
  )
}

export const trashService = {
  /**
   * entity를 휴지통으로 이동. cascade 자식은 같은 batch_id로 묶임.
   * FS 도메인이면 워크스페이스 내 파일을 `<userData>/trash/<wsId>/<batchId>/...`로 이동.
   * @returns 생성된 trash_batch_id
   */
  async softRemove(
    workspaceId: string,
    entityType: TrashEntityKind,
    entityId: string,
    options: SoftRemoveOptions = {}
  ): Promise<string> {
    return notImplemented('softRemove', workspaceId, entityType, entityId, options)
  },

  /**
   * batch 단위 복구. deletedAt = NULL로 되돌리고 FS는 trash → 워크스페이스로 이동.
   * 충돌 시 resolveNameConflict로 자동 rename.
   */
  async restore(batchId: string): Promise<{
    restored: { type: TrashEntityKind; id: string; title: string }[]
    conflicts?: { id: string; reason: string }[]
  }> {
    return notImplemented('restore', batchId)
  },

  /** batch 영구 삭제 (DB row 하드 삭제 + FS trash 디렉토리 제거) */
  async purge(batchId: string): Promise<void> {
    notImplemented('purge', batchId)
  },

  /** workspace 단위 휴지통 batch 목록 */
  list(workspaceId: string, options: TrashListOptions = {}): TrashListResult {
    return notImplemented('list', workspaceId, options)
  },

  /**
   * deletedAt < (now - cutoffMs)인 batch 모두 purge.
   * main 프로세스 1시간 cron에서 호출.
   * @returns purge된 batch 수
   */
  async sweep(workspaceId: string, cutoffMs: number): Promise<number> {
    return notImplemented('sweep', workspaceId, cutoffMs)
  }
}
