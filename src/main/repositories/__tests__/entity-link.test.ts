import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { entityLinkRepository, type EntityLinkInsert } from '../entity-link'

const WS_ID = 'ws-1'

beforeEach(() => {
  testDb
    .insert(schema.workspaces)
    .values({
      id: WS_ID,
      name: 'Test',
      path: '/test',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
})

function makeLink(overrides?: Partial<EntityLinkInsert>): EntityLinkInsert {
  return {
    sourceType: 'note',
    sourceId: 'note-1',
    targetType: 'todo',
    targetId: 'todo-1',
    workspaceId: WS_ID,
    createdAt: new Date(),
    ...overrides
  }
}

describe('link', () => {
  it('링크 생성 → findByEntity로 조회 가능', () => {
    entityLinkRepository.link(makeLink())
    const result = entityLinkRepository.findByEntity('note', 'note-1')
    expect(result).toHaveLength(1)
  })

  it('중복 링크 시도 → 에러 없이 무시 (onConflictDoNothing)', () => {
    const data = makeLink()
    entityLinkRepository.link(data)
    entityLinkRepository.link(data)
    const result = entityLinkRepository.findByEntity('note', 'note-1')
    expect(result).toHaveLength(1)
  })

  it('다른 엔티티 쌍 → 각각 생성', () => {
    entityLinkRepository.link(makeLink())
    entityLinkRepository.link(makeLink({ sourceType: 'csv', sourceId: 'csv-1' }))
    const result = entityLinkRepository.findByEntity('todo', 'todo-1')
    expect(result).toHaveLength(2)
  })
})

describe('unlink', () => {
  it('존재하는 링크 삭제 → findByEntity 빈 배열', () => {
    entityLinkRepository.link(makeLink())
    entityLinkRepository.unlink('note', 'note-1', 'todo', 'todo-1')
    expect(entityLinkRepository.findByEntity('note', 'note-1')).toHaveLength(0)
  })

  it('존재하지 않는 링크 삭제 → 에러 없음', () => {
    expect(() => entityLinkRepository.unlink('note', 'x', 'todo', 'y')).not.toThrow()
  })
})

describe('findByEntity', () => {
  it('source 방향으로 매칭', () => {
    entityLinkRepository.link(makeLink())
    const result = entityLinkRepository.findByEntity('note', 'note-1')
    expect(result).toHaveLength(1)
    expect(result[0].sourceType).toBe('note')
  })

  it('target 방향으로 매칭 (양방향 조회)', () => {
    entityLinkRepository.link(makeLink())
    const result = entityLinkRepository.findByEntity('todo', 'todo-1')
    expect(result).toHaveLength(1)
    expect(result[0].targetType).toBe('todo')
  })

  it('무관한 엔티티 → 빈 배열', () => {
    entityLinkRepository.link(makeLink())
    expect(entityLinkRepository.findByEntity('pdf', 'pdf-99')).toHaveLength(0)
  })

  it('여러 링크가 있는 엔티티 → 모두 반환', () => {
    entityLinkRepository.link(makeLink())
    entityLinkRepository.link(makeLink({ sourceId: 'note-2' }))
    entityLinkRepository.link(makeLink({ sourceType: 'csv', sourceId: 'csv-1' }))
    const result = entityLinkRepository.findByEntity('todo', 'todo-1')
    expect(result).toHaveLength(3)
  })

  it('createdAt이 Date 인스턴스로 반환', () => {
    entityLinkRepository.link(makeLink())
    const result = entityLinkRepository.findByEntity('note', 'note-1')
    expect(result[0].createdAt).toBeInstanceOf(Date)
  })
})

describe('removeAllByEntity', () => {
  it('source로 참여한 링크 모두 삭제', () => {
    entityLinkRepository.link(makeLink())
    entityLinkRepository.link(makeLink({ targetType: 'pdf', targetId: 'pdf-1' }))
    entityLinkRepository.removeAllByEntity('note', 'note-1')
    expect(entityLinkRepository.findByEntity('note', 'note-1')).toHaveLength(0)
  })

  it('target으로 참여한 링크도 삭제', () => {
    entityLinkRepository.link(makeLink())
    entityLinkRepository.removeAllByEntity('todo', 'todo-1')
    expect(entityLinkRepository.findByEntity('note', 'note-1')).toHaveLength(0)
  })

  it('무관한 링크는 유지', () => {
    entityLinkRepository.link(makeLink())
    entityLinkRepository.link(
      makeLink({
        sourceType: 'csv',
        sourceId: 'csv-1',
        targetType: 'pdf',
        targetId: 'pdf-1'
      })
    )
    entityLinkRepository.removeAllByEntity('note', 'note-1')
    expect(entityLinkRepository.findByEntity('csv', 'csv-1')).toHaveLength(1)
  })
})

describe('removeAllByEntities', () => {
  it('여러 ID의 링크 일괄 삭제', () => {
    entityLinkRepository.link(
      makeLink({ sourceType: 'todo', sourceId: 'todo-a', targetType: 'note', targetId: 'n1' })
    )
    entityLinkRepository.link(
      makeLink({ sourceType: 'todo', sourceId: 'todo-b', targetType: 'note', targetId: 'n2' })
    )
    entityLinkRepository.link(
      makeLink({ sourceType: 'todo', sourceId: 'todo-c', targetType: 'note', targetId: 'n3' })
    )
    entityLinkRepository.removeAllByEntities('todo', ['todo-a', 'todo-b', 'todo-c'])
    expect(entityLinkRepository.findByEntity('todo', 'todo-a')).toHaveLength(0)
    expect(entityLinkRepository.findByEntity('todo', 'todo-b')).toHaveLength(0)
    expect(entityLinkRepository.findByEntity('todo', 'todo-c')).toHaveLength(0)
  })

  it('빈 배열 → no-op', () => {
    entityLinkRepository.link(makeLink())
    entityLinkRepository.removeAllByEntities('todo', [])
    expect(entityLinkRepository.findByEntity('note', 'note-1')).toHaveLength(1)
  })
})
