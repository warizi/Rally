import type { CollectedRows } from '../cascade-collector'
import type { TrashEntityKind } from '../types'

/**
 * soft-delete handler 의 컨텍스트.
 *
 * folder/file 도메인은 workspaceId(워크스페이스 경로 조회용) + batchId(FS trash
 * 경로 생성용) 가 모두 필요. canvas/todo 등은 사용하지 않을 수도 있음.
 */
export interface HandlerContext {
  workspaceId: string
  /** softRemove 트랜잭션의 trash_batch_id — FS 이동 destination 경로 산출에 사용 */
  batchId: string
}

/**
 * 휴지통 도메인 핸들러 — entity 별 cascade 수집 책임을 분리한다.
 *
 * Phase 2 (현재): `collectCascade` 만 정의 — 기존 `collectXxxCascade` 함수를
 * 핸들러로 옮기는 단계.
 *
 * Phase 4 (예정): restore / hardDelete / captureSnapshot 도 인터페이스에 추가.
 * 그때 신규 entity 추가 = 새 handler 파일 1개 작성 + registry 등록 1줄 = 끝.
 */
export interface SoftDeleteHandler<T extends TrashEntityKind = TrashEntityKind> {
  entityType: T
  /**
   * root entity 삭제 시 어떤 row 들이 함께 trash 로 들어가야 하는지 + 어떤 FS
   * 이동이 필요한지 산출. 순수 함수 (DB 읽기만, 쓰기 없음).
   */
  collectCascade(rootId: string, ctx: HandlerContext): CollectedRows
}
