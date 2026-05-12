import { getTrashHandler } from './handlers/registry'
import type { TrashEntityKind } from './types'

/**
 * 휴지통 cascade 수집기.
 *
 * Phase 3 종료 후: 모든 entity 가 handler 로 이전되어 본 파일은 dispatcher
 * 와 CollectedRows 타입만 보유. 도메인 별 수집 로직은 `./handlers/{X}.handler.ts`.
 */

// ─── 결과 타입 ───────────────────────────────────────────────

export interface CollectedRows {
  todoIds: string[]
  scheduleIds: string[]
  recurringRuleIds: string[]
  canvasIds: string[]
  canvasNodeIds: string[]
  canvasEdgeIds: string[]
  canvasGroupIds: string[]
  noteIds: string[]
  csvIds: string[]
  pdfIds: string[]
  imageIds: string[]
  folderIds: string[]
  templateIds: string[]
  /** 사용자가 직접 삭제 액션한 root entity 의 메타 (UI 표시용) */
  rootTitle: string
  /** FS 파일 도메인의 경우 워크스페이스 내 원본 절대 경로 → trash 절대 경로 매핑 */
  fsMoves: Array<{ src: string; dst: string; relativePath: string }>
}

export function emptyCollected(): CollectedRows {
  return {
    todoIds: [],
    scheduleIds: [],
    recurringRuleIds: [],
    canvasIds: [],
    canvasNodeIds: [],
    canvasEdgeIds: [],
    canvasGroupIds: [],
    noteIds: [],
    csvIds: [],
    pdfIds: [],
    imageIds: [],
    folderIds: [],
    templateIds: [],
    rootTitle: '',
    fsMoves: []
  }
}

// ─── dispatcher ───────────────────────────────────────────────

/**
 * entity type 에 따른 cascade 수집.
 *
 * 모든 entity 는 `./handlers/{X}.handler.ts` 에서 정의되고 import 부수효과로
 * registry 에 등록됨. handler 미등록 시 throw (Phase 2 의 fallback switch 제거).
 *
 * 신규 entity 추가:
 *   1. `./handlers/{new}.handler.ts` 작성
 *   2. `./handlers/index.ts` 에 `registerTrashHandler(newHandler)` 추가
 *   본 파일은 수정 불필요.
 */
export function collectCascade(
  workspaceId: string,
  entityType: TrashEntityKind,
  entityId: string,
  batchId: string
): CollectedRows {
  const handler = getTrashHandler(entityType)
  if (!handler) {
    throw new Error(
      `No trash handler registered for entity type '${entityType}'. ` +
        `Add a handler at trash/handlers/${entityType}.handler.ts and register it in handlers/index.ts.`
    )
  }
  return handler.collectCascade(entityId, { workspaceId, batchId })
}

// ─── child count 합계 ────────────────────────────────────────

export function totalChildCount(rows: CollectedRows): number {
  return (
    rows.todoIds.length +
    rows.scheduleIds.length +
    rows.recurringRuleIds.length +
    rows.canvasIds.length +
    rows.canvasNodeIds.length +
    rows.canvasEdgeIds.length +
    rows.canvasGroupIds.length +
    rows.noteIds.length +
    rows.csvIds.length +
    rows.pdfIds.length +
    rows.imageIds.length +
    rows.folderIds.length +
    rows.templateIds.length -
    1 // root entity 자신 제외
  )
}
