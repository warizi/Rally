import type { SoftDeleteHandler } from './handler.interface'
import type { TrashEntityKind } from '../types'

/**
 * entity type → handler 매핑.
 *
 * 점진 이전 (Phase 2-3): 등록된 handler 가 있으면 registry 로, 없으면
 * 기존 `cascade-collector.ts` 의 `collect{X}Cascade` 함수로 fallback.
 *
 * Phase 3 종료 시점에 모든 entity 가 등록되면 fallback 경로 제거.
 */
const handlers = new Map<TrashEntityKind, SoftDeleteHandler>()

export function registerTrashHandler(handler: SoftDeleteHandler): void {
  handlers.set(handler.entityType, handler)
}

export function getTrashHandler(entityType: TrashEntityKind): SoftDeleteHandler | undefined {
  return handlers.get(entityType)
}

/** 테스트 / 디버깅 용도 — 현재 등록된 entity type 목록 */
export function listRegisteredHandlers(): TrashEntityKind[] {
  return Array.from(handlers.keys())
}
