import { describe, expect, it, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { trashService } from '../trash'
import { trashSweeper } from '../trash-sweeper'
import { todoRepository } from '../../repositories/todo'
import { appSettingsRepository } from '../../repositories/app-settings'

const WS_A = 'ws-sweep-a'
const WS_B = 'ws-sweep-b'

beforeEach(() => {
  testDb.delete(schema.entityLinks).run()
  testDb.delete(schema.todos).run()
  testDb.delete(schema.trashBatches).run()
  testDb.delete(schema.appSettings).run()
  testDb.delete(schema.workspaces).run()
  testDb
    .insert(schema.workspaces)
    .values([
      { id: WS_A, name: 'A', path: '/a', createdAt: new Date(), updatedAt: new Date() },
      { id: WS_B, name: 'B', path: '/b', createdAt: new Date(), updatedAt: new Date() }
    ])
    .run()
})

function seedTodo(id: string, ws = WS_A): void {
  testDb
    .insert(schema.todos)
    .values({
      id,
      workspaceId: ws,
      title: id,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function ageOutBatch(batchId: string, daysAgo: number): void {
  const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  testDb
    .update(schema.trashBatches)
    .set({ deletedAt: past })
    .where(eq(schema.trashBatches.id, batchId))
    .run()
}

describe('trashService 설정 헬퍼', () => {
  it('default retention은 30일', () => {
    expect(trashService.getRetention()).toBe('30')
  })

  it('setRetention으로 변경 가능', () => {
    trashService.setRetention('7')
    expect(trashService.getRetention()).toBe('7')
    expect(appSettingsRepository.get('trash.autoEmptyDays')).toBe('7')
  })

  it('잘못된 값은 ValidationError', () => {
    expect(() => trashService.setRetention('bogus' as never)).toThrow()
  })

  it('never 설정 시 sweepAll은 0 반환 + 아무것도 purge 안 함', () => {
    seedTodo('td-old')
    const batchId = trashService.softRemove(WS_A, 'todo', 'td-old')
    ageOutBatch(batchId, 365)

    trashService.setRetention('never')
    const purged = trashService.sweepAll()
    expect(purged).toBe(0)
    expect(todoRepository.findByIdIncludingDeleted('td-old')).toBeDefined()
  })
})

describe('trashService.sweepAll — 다중 워크스페이스', () => {
  it('두 워크스페이스의 만료된 batch 모두 정리', () => {
    seedTodo('a-old', WS_A)
    seedTodo('a-new', WS_A)
    seedTodo('b-old', WS_B)

    const aOld = trashService.softRemove(WS_A, 'todo', 'a-old')
    trashService.softRemove(WS_A, 'todo', 'a-new')
    const bOld = trashService.softRemove(WS_B, 'todo', 'b-old')

    ageOutBatch(aOld, 60)
    ageOutBatch(bOld, 60)

    trashService.setRetention('30')
    const purged = trashService.sweepAll()
    expect(purged).toBe(2)
    expect(todoRepository.findByIdIncludingDeleted('a-old')).toBeUndefined()
    expect(todoRepository.findByIdIncludingDeleted('a-new')).toBeDefined()
    expect(todoRepository.findByIdIncludingDeleted('b-old')).toBeUndefined()
  })

  it('retention보다 짧은 batch는 살아남음', () => {
    seedTodo('young', WS_A)
    const batchId = trashService.softRemove(WS_A, 'todo', 'young')
    ageOutBatch(batchId, 7)

    trashService.setRetention('30')
    const purged = trashService.sweepAll()
    expect(purged).toBe(0)
    expect(todoRepository.findByIdIncludingDeleted('young')).toBeDefined()
  })
})

describe('trashSweeper — runOnce는 sweepAll 호출', () => {
  it('runOnce 호출 시 만료 batch 정리', () => {
    seedTodo('td-stale', WS_A)
    const batchId = trashService.softRemove(WS_A, 'todo', 'td-stale')
    ageOutBatch(batchId, 100)

    trashService.setRetention('30')
    trashSweeper.runOnce()
    expect(todoRepository.findByIdIncludingDeleted('td-stale')).toBeUndefined()
  })
})
