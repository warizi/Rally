/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { entityLinkService } from '../entity-link'
import { entityLinkRepository } from '../../repositories/entity-link'
import { todoRepository } from '../../repositories/todo'
import { scheduleRepository } from '../../repositories/schedule'
import { noteRepository } from '../../repositories/note'
import { pdfFileRepository } from '../../repositories/pdf-file'
import { csvFileRepository } from '../../repositories/csv-file'
import { NotFoundError, ValidationError } from '../../lib/errors'
import type { LinkableEntityType } from '../../db/schema/entity-link'

vi.mock('../../repositories/entity-link', () => ({
  entityLinkRepository: {
    link: vi.fn(),
    unlink: vi.fn(),
    findByEntity: vi.fn(),
    removeAllByEntity: vi.fn(),
    removeAllByEntities: vi.fn()
  }
}))

vi.mock('../../repositories/todo', () => ({ todoRepository: { findById: vi.fn() } }))
vi.mock('../../repositories/schedule', () => ({ scheduleRepository: { findById: vi.fn() } }))
vi.mock('../../repositories/note', () => ({ noteRepository: { findById: vi.fn() } }))
vi.mock('../../repositories/pdf-file', () => ({ pdfFileRepository: { findById: vi.fn() } }))
vi.mock('../../repositories/csv-file', () => ({ csvFileRepository: { findById: vi.fn() } }))

const MOCK_ENTITY = { workspaceId: 'ws-1', title: 'Test Entity' }

// ⚠️ returnValue에 undefined를 넘기면 JS default parameter가 트리거되어 MOCK_ENTITY가 사용됨.
// "미존재" 시나리오는 resetAllMocks 후 mock을 설정하지 않거나, mockReturnValue를 직접 호출할 것.
function mockFindById(type: LinkableEntityType, returnValue: unknown = MOCK_ENTITY): void {
  switch (type) {
    case 'todo':
      vi.mocked(todoRepository.findById).mockReturnValue(returnValue as any)
      break
    case 'schedule':
      vi.mocked(scheduleRepository.findById).mockReturnValue(returnValue as any)
      break
    case 'note':
      vi.mocked(noteRepository.findById).mockReturnValue(returnValue as any)
      break
    case 'pdf':
      vi.mocked(pdfFileRepository.findById).mockReturnValue(returnValue as any)
      break
    case 'csv':
      vi.mocked(csvFileRepository.findById).mockReturnValue(returnValue as any)
      break
  }
}

// 같은 타입(todo↔todo)일 때 mockFindById 1회만 호출.
// mockReturnValue는 영구 설정이므로 findEntity가 2회 호출되어도 같은 값 반환.
function mockBothEntities(typeA: LinkableEntityType, typeB: LinkableEntityType): void {
  mockFindById(typeA)
  if (typeA !== typeB) mockFindById(typeB)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('link', () => {
  it('정상 링크 — entityLinkRepository.link 호출', () => {
    mockBothEntities('todo', 'note')
    entityLinkService.link('todo', 't1', 'note', 'n1', 'ws-1')
    expect(entityLinkRepository.link).toHaveBeenCalledTimes(1)
  })

  it('정규화: todo+note → source=note, target=todo', () => {
    mockBothEntities('todo', 'note')
    entityLinkService.link('todo', 't1', 'note', 'n1', 'ws-1')
    expect(entityLinkRepository.link).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'note', targetType: 'todo' })
    )
  })

  it('정규화 Branch 3: 같은 타입, idA < idB → source=idA', () => {
    mockFindById('todo')
    entityLinkService.link('todo', 'a-id', 'todo', 'b-id', 'ws-1')
    expect(entityLinkRepository.link).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'a-id', targetId: 'b-id' })
    )
  })

  it('정규화 Branch 4: 같은 타입, idA > idB → 역전', () => {
    mockFindById('todo')
    entityLinkService.link('todo', 'b-id', 'todo', 'a-id', 'ws-1')
    expect(entityLinkRepository.link).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'a-id', targetId: 'b-id' })
    )
  })

  it('EC-01: 자기 자신 링크 → ValidationError (findById 호출 안 됨)', () => {
    expect(() => entityLinkService.link('todo', 'id-1', 'todo', 'id-1', 'ws-1')).toThrow(
      ValidationError
    )
    expect(todoRepository.findById).not.toHaveBeenCalled()
  })

  // resetAllMocks 후 mock 미설정 → findById가 undefined 반환 → NotFoundError
  it('EC-02: typeA 엔티티 미존재 → NotFoundError', () => {
    expect(() => entityLinkService.link('todo', 't1', 'note', 'n1', 'ws-1')).toThrow(NotFoundError)
  })

  it('EC-02: typeB 엔티티 미존재 → NotFoundError', () => {
    mockFindById('todo')
    // note는 mock 미설정 → resetAllMocks 후 undefined 반환
    expect(() => entityLinkService.link('todo', 't1', 'note', 'n1', 'ws-1')).toThrow(NotFoundError)
  })

  it('EC-03: 다른 워크스페이스 → ValidationError', () => {
    mockFindById('todo')
    mockFindById('note', { workspaceId: 'ws-2', title: 'Other' })
    expect(() => entityLinkService.link('todo', 't1', 'note', 'n1', 'ws-1')).toThrow(
      ValidationError
    )
  })

  it('EC-03: 전달된 workspaceId 불일치 → ValidationError', () => {
    mockBothEntities('todo', 'note')
    expect(() => entityLinkService.link('todo', 't1', 'note', 'n1', 'ws-other')).toThrow(
      ValidationError
    )
  })

  it('createdAt 필드 포함 (Date 인스턴스)', () => {
    mockBothEntities('todo', 'note')
    entityLinkService.link('todo', 't1', 'note', 'n1', 'ws-1')
    expect(entityLinkRepository.link).toHaveBeenCalledWith(
      expect.objectContaining({ createdAt: expect.any(Date) })
    )
  })

  it('entityA의 workspaceId가 null → ValidationError (L81)', () => {
    mockFindById('schedule', { workspaceId: null, title: 'T' })
    mockFindById('note')
    expect(() => entityLinkService.link('schedule', 's1', 'note', 'n1', 'ws-1')).toThrow(
      ValidationError
    )
  })

  it('entityB만 workspaceId null → ValidationError (L82)', () => {
    mockFindById('todo')
    mockFindById('schedule', { workspaceId: null, title: 'T' })
    expect(() => entityLinkService.link('todo', 't1', 'schedule', 's1', 'ws-1')).toThrow(
      ValidationError
    )
  })
})

describe('unlink', () => {
  it('정상 언링크 — 정규화 후 repository.unlink 호출', () => {
    entityLinkService.unlink('todo', 't1', 'note', 'n1')
    expect(entityLinkRepository.unlink).toHaveBeenCalledWith('note', 'n1', 'todo', 't1')
  })

  it('역순 인자 전달해도 동일 정규화', () => {
    entityLinkService.unlink('note', 'n1', 'todo', 't1')
    expect(entityLinkRepository.unlink).toHaveBeenCalledWith('note', 'n1', 'todo', 't1')
  })
})

describe('getLinked', () => {
  const makeRow = (overrides?: Record<string, unknown>): Record<string, unknown> => ({
    sourceType: 'note',
    sourceId: 'n1',
    targetType: 'todo',
    targetId: 't1',
    workspaceId: 'ws-1',
    createdAt: new Date('2026-01-01'),
    ...overrides
  })

  it('source 방향 링크 → linkedType/linkedId 정확 추출', () => {
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([makeRow()] as any)
    mockFindById('todo')
    const result = entityLinkService.getLinked('note', 'n1')
    expect(result[0].entityType).toBe('todo')
    expect(result[0].entityId).toBe('t1')
  })

  it('target 방향 링크 → linkedType/linkedId 정확 추출', () => {
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([makeRow()] as any)
    mockFindById('note')
    const result = entityLinkService.getLinked('todo', 't1')
    expect(result[0].entityType).toBe('note')
    expect(result[0].entityId).toBe('n1')
  })

  it('엔티티 제목 포함', () => {
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([makeRow()] as any)
    mockFindById('todo', { workspaceId: 'ws-1', title: '내 할일' })
    const result = entityLinkService.getLinked('note', 'n1')
    expect(result[0].title).toBe('내 할일')
  })

  // resetAllMocks 후 todo mock 미설정 → findEntity가 undefined 반환 → orphan 처리
  it('EC-09: 삭제된 엔티티 → 필터링 + orphan unlink', () => {
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([makeRow()] as any)
    const result = entityLinkService.getLinked('note', 'n1')
    expect(result).toHaveLength(0)
    expect(entityLinkRepository.unlink).toHaveBeenCalledWith('note', 'n1', 'todo', 't1')
  })

  it('혼합: 유효 2건 + 고아 1건 → result 2건 + unlink 1회', () => {
    // 3개 row 모두 targetType='todo'이므로 findEntity가 todoRepository.findById만 호출.
    // mockReturnValueOnce 체이닝은 호출 순서에 의존.
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([
      makeRow(),
      makeRow({ targetId: 't2' }),
      makeRow({ targetId: 't-orphan' })
    ] as any)
    vi.mocked(todoRepository.findById)
      .mockReturnValueOnce(MOCK_ENTITY as any) // t1 존재
      .mockReturnValueOnce(MOCK_ENTITY as any) // t2 존재
      .mockReturnValueOnce(undefined) // t-orphan 미존재
    const result = entityLinkService.getLinked('note', 'n1')
    expect(result).toHaveLength(2)
    expect(entityLinkRepository.unlink).toHaveBeenCalledTimes(1)
  })

  it('빈 결과 → 빈 배열 반환', () => {
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([])
    const result = entityLinkService.getLinked('note', 'n1')
    expect(result).toEqual([])
  })

  it('linkedAt 필드 포함', () => {
    const createdAt = new Date('2026-01-15')
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([makeRow({ createdAt })] as any)
    mockFindById('todo')
    const result = entityLinkService.getLinked('note', 'n1')
    expect(result[0].linkedAt).toBe(createdAt)
  })

  it('같은 타입 링크(todo↔todo) — isSource=true 방향', () => {
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([
      makeRow({ sourceType: 'todo', sourceId: 't-1', targetType: 'todo', targetId: 't-2' })
    ] as any)
    mockFindById('todo', { workspaceId: 'ws-1', title: 'Target Todo' })
    const result = entityLinkService.getLinked('todo', 't-1')
    expect(result[0].entityType).toBe('todo')
    expect(result[0].entityId).toBe('t-2')
  })

  it('같은 타입 링크(todo↔todo) — isSource=false 방향', () => {
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([
      makeRow({ sourceType: 'todo', sourceId: 't-1', targetType: 'todo', targetId: 't-2' })
    ] as any)
    mockFindById('todo', { workspaceId: 'ws-1', title: 'Source Todo' })
    const result = entityLinkService.getLinked('todo', 't-2')
    expect(result[0].entityType).toBe('todo')
    expect(result[0].entityId).toBe('t-1')
  })

  it('전부 고아인 경우 → 빈 배열 + orphan 전체 unlink', () => {
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([
      makeRow({ targetId: 'dead-1' }),
      makeRow({ targetId: 'dead-2' })
    ] as any)
    // resetAllMocks 후 기본 undefined 반환 — 모든 엔티티 미존재
    const result = entityLinkService.getLinked('note', 'n1')
    expect(result).toEqual([])
    expect(entityLinkRepository.unlink).toHaveBeenCalledTimes(2)
  })
})

describe('removeAllLinks', () => {
  it('repository.removeAllByEntity 위임 호출', () => {
    entityLinkService.removeAllLinks('todo', 't1')
    expect(entityLinkRepository.removeAllByEntity).toHaveBeenCalledWith('todo', 't1')
  })
})

describe('removeAllLinksForTodos', () => {
  it("repository.removeAllByEntities('todo', ids) 위임 호출", () => {
    entityLinkService.removeAllLinksForTodos(['t1', 't2'])
    expect(entityLinkRepository.removeAllByEntities).toHaveBeenCalledWith('todo', ['t1', 't2'])
  })
})
