import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { reminderRepository } from '../reminder'

beforeEach(() => {
  testDb.delete(schema.reminders).run()
})

function makeReminder(overrides?: Partial<typeof schema.reminders.$inferInsert>) {
  return {
    id: 'rem-1',
    entityType: 'todo' as const,
    entityId: 'todo-1',
    offsetMs: 600000,
    remindAt: new Date('2026-06-01T09:00:00Z'),
    isFired: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides
  }
}

describe('findByEntity', () => {
  it('entity에 알림 2개 존재 → 2개 반환', () => {
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r1' })).run()
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r2', offsetMs: 1800000 })).run()
    const result = reminderRepository.findByEntity('todo', 'todo-1')
    expect(result).toHaveLength(2)
  })

  it('entity에 알림 없음 → 빈 배열', () => {
    const result = reminderRepository.findByEntity('todo', 'no-entity')
    expect(result).toEqual([])
  })

  it('다른 entityType의 동일 entityId → 해당 타입만 반환', () => {
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r1', entityType: 'todo' })).run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', entityType: 'schedule' }))
      .run()
    const result = reminderRepository.findByEntity('todo', 'todo-1')
    expect(result).toHaveLength(1)
    expect(result[0].entityType).toBe('todo')
  })
})

describe('findPending', () => {
  const now = new Date('2026-06-01T10:00:00Z')

  it('remindAt <= now, isFired=false → 반환', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ remindAt: new Date('2026-06-01T09:00:00Z'), isFired: false }))
      .run()
    const result = reminderRepository.findPending(now)
    expect(result).toHaveLength(1)
  })

  it('remindAt > now → 미반환', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ remindAt: new Date('2026-06-01T11:00:00Z') }))
      .run()
    const result = reminderRepository.findPending(now)
    expect(result).toHaveLength(0)
  })

  it('remindAt <= now, isFired=true → 미반환', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ remindAt: new Date('2026-06-01T09:00:00Z'), isFired: true }))
      .run()
    const result = reminderRepository.findPending(now)
    expect(result).toHaveLength(0)
  })
})

describe('findById', () => {
  it('존재하는 ID → Reminder 반환', () => {
    testDb.insert(schema.reminders).values(makeReminder()).run()
    const result = reminderRepository.findById('rem-1')
    expect(result).toBeDefined()
    expect(result!.id).toBe('rem-1')
  })

  it('없는 ID → undefined', () => {
    expect(reminderRepository.findById('no-id')).toBeUndefined()
  })
})

describe('create', () => {
  it('모든 필드 포함 생성 → returning 반환', () => {
    const data = makeReminder()
    const result = reminderRepository.create(data)
    expect(result.id).toBe('rem-1')
    expect(result.entityType).toBe('todo')
    expect(result.offsetMs).toBe(600000)
    expect(result.remindAt).toBeInstanceOf(Date)
    expect(result.isFired).toBe(false)
  })
})

describe('update', () => {
  it('remindAt + isFired 부분 업데이트 → 변경된 값 반환', () => {
    testDb.insert(schema.reminders).values(makeReminder()).run()
    const newTime = new Date('2026-07-01T12:00:00Z')
    const result = reminderRepository.update('rem-1', {
      remindAt: newTime,
      isFired: true,
      updatedAt: new Date()
    })
    expect(result).toBeDefined()
    expect(result!.remindAt.getTime()).toBe(newTime.getTime())
    expect(result!.isFired).toBe(true)
  })

  it('존재하지 않는 ID → undefined', () => {
    const result = reminderRepository.update('no-id', { isFired: true, updatedAt: new Date() })
    expect(result).toBeUndefined()
  })
})

describe('markFired', () => {
  it('isFired=false → true 전환, updatedAt 갱신', () => {
    testDb.insert(schema.reminders).values(makeReminder({ isFired: false })).run()
    const now = new Date()
    reminderRepository.markFired('rem-1', now)
    const row = reminderRepository.findById('rem-1')
    expect(row!.isFired).toBe(true)
    expect(row!.updatedAt.getTime()).toBe(now.getTime())
  })
})

describe('delete', () => {
  it('삭제 후 findById → undefined', () => {
    testDb.insert(schema.reminders).values(makeReminder()).run()
    reminderRepository.delete('rem-1')
    expect(reminderRepository.findById('rem-1')).toBeUndefined()
  })
})

describe('deleteByEntity', () => {
  it('entity 알림 3개 → 전부 삭제', () => {
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r1' })).run()
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r2', offsetMs: 1800000 })).run()
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r3', offsetMs: 3600000 })).run()
    reminderRepository.deleteByEntity('todo', 'todo-1')
    expect(reminderRepository.findByEntity('todo', 'todo-1')).toEqual([])
  })

  it('다른 entity 알림은 유지', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r1', entityId: 'todo-1' }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', entityId: 'todo-2' }))
      .run()
    reminderRepository.deleteByEntity('todo', 'todo-1')
    expect(reminderRepository.findByEntity('todo', 'todo-2')).toHaveLength(1)
  })
})

describe('deleteByEntities', () => {
  it('entityIds 2개, 각 알림 2개 → 4개 전부 삭제', () => {
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r1', entityId: 'a' })).run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', entityId: 'a', offsetMs: 1800000 }))
      .run()
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r3', entityId: 'b' })).run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r4', entityId: 'b', offsetMs: 1800000 }))
      .run()
    reminderRepository.deleteByEntities('todo', ['a', 'b'])
    expect(reminderRepository.findByEntity('todo', 'a')).toEqual([])
    expect(reminderRepository.findByEntity('todo', 'b')).toEqual([])
  })

  it('빈 배열 전달 → 아무것도 삭제하지 않음', () => {
    testDb.insert(schema.reminders).values(makeReminder()).run()
    reminderRepository.deleteByEntities('todo', [])
    expect(reminderRepository.findByEntity('todo', 'todo-1')).toHaveLength(1)
  })
})

describe('deleteUnfiredByEntity', () => {
  it('fired 1개 + unfired 2개 → unfired만 삭제', () => {
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r1', isFired: true })).run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', isFired: false, offsetMs: 1800000 }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r3', isFired: false, offsetMs: 3600000 }))
      .run()
    reminderRepository.deleteUnfiredByEntity('todo', 'todo-1')
    const remaining = reminderRepository.findByEntity('todo', 'todo-1')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].isFired).toBe(true)
  })

  it('전부 fired → 삭제 없음', () => {
    testDb.insert(schema.reminders).values(makeReminder({ id: 'r1', isFired: true })).run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', isFired: true, offsetMs: 1800000 }))
      .run()
    reminderRepository.deleteUnfiredByEntity('todo', 'todo-1')
    expect(reminderRepository.findByEntity('todo', 'todo-1')).toHaveLength(2)
  })
})
