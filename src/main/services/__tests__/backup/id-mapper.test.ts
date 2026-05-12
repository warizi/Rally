/**
 * IdMapper 단위 테스트 (P0-2 Phase 2 게이트).
 *
 * 인메모리 DB 의존성 없음 — 순수 클래스 테스트.
 */
import { describe, it, expect } from 'vitest'
import { IdMapper, type BackupEntityType } from '../../backup/id-mapper'

describe('IdMapper', () => {
  // ──────────────────────────────────────────────
  // S1: register — 새 ID 생성 + 같은 oldId 재호출 시 같은 newId 반환
  // ──────────────────────────────────────────────
  it('S1 — register returns a stable newId for the same (type, oldId)', () => {
    const mapper = new IdMapper()
    const id1 = mapper.register('folder', 'old-folder-1')
    const id2 = mapper.register('folder', 'old-folder-1')
    expect(id1).toBe(id2)
    expect(id1).not.toBe('old-folder-1') // 새 ID 발급 확인
  })

  // ──────────────────────────────────────────────
  // S2: map — 미등록 oldId 호출 시 명시적 throw
  // ──────────────────────────────────────────────
  it('S2 — map throws when oldId is not registered', () => {
    const mapper = new IdMapper()
    expect(() => mapper.map('folder', 'unknown-id')).toThrow(/ID mapping not found/)
    expect(() => mapper.map('todo', 'unknown-id')).toThrow(/type='todo'/)
  })

  // ──────────────────────────────────────────────
  // S3: mapOrNull — null 입력은 null 반환, 비-null 은 map 위임
  // ──────────────────────────────────────────────
  it('S3 — mapOrNull passes through null and maps non-null', () => {
    const mapper = new IdMapper()
    const newId = mapper.register('note', 'old-note')

    expect(mapper.mapOrNull('note', null)).toBeNull()
    expect(mapper.mapOrNull('note', 'old-note')).toBe(newId)
    // 미등록은 throw (mapOrNull 도 map 위임)
    expect(() => mapper.mapOrNull('note', 'unknown')).toThrow()
  })

  // ──────────────────────────────────────────────
  // S4: mapOrSkip — 고아 안전 (미등록 시 null)
  // ──────────────────────────────────────────────
  it('S4 — mapOrSkip returns null for unregistered (no throw)', () => {
    const mapper = new IdMapper()
    const newId = mapper.register('canvas', 'old-canvas')

    expect(mapper.mapOrSkip('canvas', 'old-canvas')).toBe(newId)
    expect(mapper.mapOrSkip('canvas', 'unknown')).toBeNull()
    expect(mapper.mapOrSkip('todo', 'unknown')).toBeNull()
  })

  // ──────────────────────────────────────────────
  // S5: type 격리 — 같은 oldId 라도 type 이 다르면 다른 newId
  // ──────────────────────────────────────────────
  it('S5 — different entity types isolate oldId space', () => {
    const mapper = new IdMapper()
    const folderId = mapper.register('folder', 'shared-old-id')
    const noteId = mapper.register('note', 'shared-old-id')

    expect(folderId).not.toBe(noteId)

    // 각 type 별로 자기 newId 만 lookup 가능
    expect(mapper.map('folder', 'shared-old-id')).toBe(folderId)
    expect(mapper.map('note', 'shared-old-id')).toBe(noteId)
    // todo 에서는 등록 안 됨
    expect(mapper.mapOrSkip('todo', 'shared-old-id')).toBeNull()
  })

  // ──────────────────────────────────────────────
  // S6: size — type 별 등록 카운트
  // ──────────────────────────────────────────────
  it('S6 — size reports per-type registration count', () => {
    const mapper = new IdMapper()
    expect(mapper.size('folder')).toBe(0)

    mapper.register('folder', 'f1')
    mapper.register('folder', 'f2')
    mapper.register('folder', 'f1') // 중복 → 카운트 증가 안 함
    mapper.register('note', 'n1')

    expect(mapper.size('folder')).toBe(2)
    expect(mapper.size('note')).toBe(1)
    expect(mapper.size('todo')).toBe(0)
  })

  // ──────────────────────────────────────────────
  // S7: 모든 BackupEntityType 가 type 인자로 허용되는지 (컴파일 타임 + 런타임)
  // ──────────────────────────────────────────────
  it('S7 — all BackupEntityType values are accepted', () => {
    const mapper = new IdMapper()
    const types: BackupEntityType[] = [
      'folder',
      'note',
      'csv',
      'pdf',
      'image',
      'todo',
      'schedule',
      'canvas',
      'canvas-node',
      'canvas-edge',
      'canvas-group',
      'tag',
      'item-tag',
      'reminder',
      'tab-snapshot',
      'recurring-rule',
      'recurring-completion',
      'template',
      'terminal-layout',
      'terminal-session'
    ]

    for (const t of types) {
      const newId = mapper.register(t, `old-${t}`)
      expect(newId).toBeTruthy()
      expect(mapper.map(t, `old-${t}`)).toBe(newId)
    }

    // 20 개 type 모두 1개씩 등록됨 — 격리 확인
    for (const t of types) {
      expect(mapper.size(t)).toBe(1)
    }
  })
})
