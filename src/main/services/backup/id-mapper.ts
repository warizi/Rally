import { nanoid } from 'nanoid'

/**
 * old ID → new ID 매핑 기능 모듈.
 *
 * Phase 1 (현재): 기존 backup.ts 의 함수형 `createIdMapper()` 그대로 이전.
 * Phase 2 (예정): 클래스 + 제네릭화로 entity type 별 격리 + any 제거.
 *
 * 사용처:
 *   - import 트랜잭션 진입 시 entity 별로 `register(oldId) → newId` 등록
 *   - FK 매핑 시 `map(oldId)` 또는 `mapOrNull(oldId)` 호출
 *   - tab JSON 등 외부 ID 참조 매핑 시 `mapOrSkip(oldId)` (고아 안전)
 */
export interface IdMapper {
  /** 새 ID 등록 — 기존에 등록된 oldId 가 있으면 그 newId 재사용 */
  register: (oldId: string) => string
  /** 필수 매핑 — 실패 시 throw */
  map: (oldId: string) => string
  /** nullable FK 매핑 — null → null */
  mapOrNull: (oldId: string | null) => string | null
  /** 고아 참조 안전 매핑 — 매핑 실패 시 null (호출자가 skip 결정) */
  mapOrSkip: (oldId: string) => string | null
}

export function createIdMapper(): IdMapper {
  const idMap = new Map<string, string>()

  return {
    register(oldId: string): string {
      const existing = idMap.get(oldId)
      if (existing) return existing
      const newId = nanoid()
      idMap.set(oldId, newId)
      return newId
    },

    map(oldId: string): string {
      const newId = idMap.get(oldId)
      if (!newId) throw new Error(`ID mapping not found: ${oldId}`)
      return newId
    },

    mapOrNull(oldId: string | null): string | null {
      return oldId != null ? this.map(oldId) : null
    },

    mapOrSkip(oldId: string): string | null {
      return idMap.get(oldId) ?? null
    }
  }
}
