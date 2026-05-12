import { nanoid } from 'nanoid'

/**
 * 백업/임포트 트랜잭션에서 다루는 entity 의 타입 유니온.
 *
 * trash 시스템의 `TrashEntityKind` 와 유사하지만 책임이 다름:
 *   - trash: 사용자 액션의 root entity (workspace 단위 cascade)
 *   - backup: import 트랜잭션의 모든 PK-가진 row (composite-PK 인 schedule-todos /
 *     entity-links 는 제외)
 */
export type BackupEntityType =
  | 'folder'
  | 'note'
  | 'csv'
  | 'pdf'
  | 'image'
  | 'todo'
  | 'schedule'
  | 'canvas'
  | 'canvas-node'
  | 'canvas-edge'
  | 'canvas-group'
  | 'tag'
  | 'item-tag'
  | 'reminder'
  | 'tab-snapshot'
  | 'recurring-rule'
  | 'recurring-completion'
  | 'template'
  | 'terminal-layout'
  | 'terminal-session'

/**
 * old ID → new ID 매핑 (import 트랜잭션 전용).
 *
 * P0-2 Phase 2: 함수형 createIdMapper 를 클래스화 + 제네릭 entity type 도입.
 *   - any 0 (Phase 1 의 함수형 IdMapper 보다 더 엄격)
 *   - entity type 별 격리 (`folder` oldId 와 `note` oldId 가 충돌하지 않음)
 *   - 단위 테스트 가능
 *
 * 사용:
 *   const mapper = new IdMapper()
 *   const newId = mapper.register('folder', oldFolderId)  // new nanoid
 *   mapper.register('folder', oldFolderId)                // 같은 newId 재사용
 *   mapper.map('folder', oldFolderId)                     // newId 반환 (없으면 throw)
 *   mapper.mapOrNull('folder', maybeNullId)               // null → null
 *   mapper.mapOrSkip('folder', oldId)                     // 미등록 → null
 */
export class IdMapper {
  private readonly maps: Map<BackupEntityType, Map<string, string>> = new Map()

  /**
   * 새 ID 등록. 이미 등록된 oldId 가 있으면 그 newId 재사용.
   * @returns 새 nanoid 또는 기존 매핑된 newId
   */
  register(type: BackupEntityType, oldId: string): string {
    const bucket = this.bucket(type)
    const existing = bucket.get(oldId)
    if (existing) return existing
    const newId = nanoid()
    bucket.set(oldId, newId)
    return newId
  }

  /**
   * 필수 매핑 — 등록되지 않은 oldId 면 throw.
   * 사용처: FK 가 NOT NULL 인 경우 (예: canvas_nodes.canvasId).
   */
  map(type: BackupEntityType, oldId: string): string {
    const newId = this.maps.get(type)?.get(oldId)
    if (!newId) {
      throw new Error(`ID mapping not found for type='${type}', oldId='${oldId}'`)
    }
    return newId
  }

  /**
   * nullable FK 매핑 — null 입력은 null 반환.
   * 사용처: 부모 FK 가 nullable 인 경우 (예: notes.folderId, todos.parentId).
   */
  mapOrNull(type: BackupEntityType, oldId: string | null): string | null {
    return oldId != null ? this.map(type, oldId) : null
  }

  /**
   * 고아 참조 안전 매핑 — 미등록 시 null 반환 (caller 가 skip 결정).
   * 사용처: 단방향 link 등 외부 참조 (entity-link 의 양쪽 ID, tab pathname 내부 ID 등).
   */
  mapOrSkip(type: BackupEntityType, oldId: string): string | null {
    return this.maps.get(type)?.get(oldId) ?? null
  }

  /**
   * type 별 등록 카운트 — 테스트/디버깅 용도.
   */
  size(type: BackupEntityType): number {
    return this.maps.get(type)?.size ?? 0
  }

  private bucket(type: BackupEntityType): Map<string, string> {
    let bucket = this.maps.get(type)
    if (!bucket) {
      bucket = new Map<string, string>()
      this.maps.set(type, bucket)
    }
    return bucket
  }
}
