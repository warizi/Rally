import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { trashService } from '../trash'
import { todoRepository } from '../../repositories/todo'
import { scheduleRepository } from '../../repositories/schedule'
import { recurringRuleRepository } from '../../repositories/recurring-rule'
import { canvasRepository } from '../../repositories/canvas'
import { canvasNodeRepository } from '../../repositories/canvas-node'
import { canvasEdgeRepository } from '../../repositories/canvas-edge'
import { entityLinkRepository } from '../../repositories/entity-link'

const WS = 'ws-trash-m2'

beforeEach(() => {
  testDb.delete(schema.entityLinks).run()
  testDb.delete(schema.reminders).run()
  testDb.delete(schema.canvasEdges).run()
  testDb.delete(schema.canvasNodes).run()
  testDb.delete(schema.canvasGroups).run()
  testDb.delete(schema.canvases).run()
  testDb.delete(schema.recurringCompletions).run()
  testDb.delete(schema.recurringRules).run()
  testDb.delete(schema.schedules).run()
  testDb.delete(schema.todos).run()
  testDb.delete(schema.trashBatches).run()
  testDb.delete(schema.workspaces).run()
  testDb
    .insert(schema.workspaces)
    .values({ id: WS, name: 'T', path: '/t', createdAt: new Date(), updatedAt: new Date() })
    .run()
})

function seedTodo(id: string, parentId: string | null = null, title = id): void {
  testDb
    .insert(schema.todos)
    .values({
      id,
      workspaceId: WS,
      parentId,
      title,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedSchedule(id: string, title = id): void {
  testDb
    .insert(schema.schedules)
    .values({
      id,
      workspaceId: WS,
      title,
      startAt: new Date('2026-05-10T09:00:00Z'),
      endAt: new Date('2026-05-10T10:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedRecurringRule(id: string, title = id): void {
  testDb
    .insert(schema.recurringRules)
    .values({
      id,
      workspaceId: WS,
      title,
      recurrenceType: 'daily',
      startDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedCanvas(id: string, title = id): void {
  testDb
    .insert(schema.canvases)
    .values({
      id,
      workspaceId: WS,
      title,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

function seedCanvasNode(id: string, canvasId: string): void {
  testDb
    .insert(schema.canvasNodes)
    .values({
      id,
      canvasId,
      type: 'text',
      x: 0,
      y: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .run()
}

describe('trashService — softRemove → list 가드', () => {
  it('todo softRemove 후 활성 list에서 사라짐', () => {
    seedTodo('td-1')
    seedTodo('td-2')
    expect(todoRepository.findByWorkspaceId(WS).length).toBe(2)

    trashService.softRemove(WS, 'todo', 'td-1')
    const active = todoRepository.findByWorkspaceId(WS)
    expect(active.map((t) => t.id)).toEqual(['td-2'])
    expect(todoRepository.findById('td-1')).toBeUndefined()
    expect(todoRepository.findByIdIncludingDeleted('td-1')).toBeDefined()
  })

  it('schedule softRemove 후 활성 list에서 사라짐', () => {
    seedSchedule('s-1')
    seedSchedule('s-2')
    trashService.softRemove(WS, 'schedule', 's-1')
    expect(scheduleRepository.findAllByWorkspaceId(WS).map((s) => s.id)).toEqual(['s-2'])
  })

  it('recurring_rule softRemove 후 활성 list에서 사라짐', () => {
    seedRecurringRule('r-1')
    seedRecurringRule('r-2')
    trashService.softRemove(WS, 'recurring_rule', 'r-1')
    expect(
      recurringRuleRepository
        .findByWorkspaceId(WS)
        .map((r) => r.id)
        .sort()
    ).toEqual(['r-2'])
  })

  it('canvas softRemove 후 nodes/edges도 함께 휴지통으로', () => {
    seedCanvas('c-1')
    seedCanvasNode('n-1', 'c-1')
    seedCanvasNode('n-2', 'c-1')
    testDb
      .insert(schema.canvasEdges)
      .values({
        id: 'e-1',
        canvasId: 'c-1',
        fromNode: 'n-1',
        toNode: 'n-2',
        createdAt: new Date()
      })
      .run()

    trashService.softRemove(WS, 'canvas', 'c-1')
    expect(canvasRepository.findByWorkspaceId(WS)).toHaveLength(0)
    expect(canvasNodeRepository.findByCanvasId('c-1')).toHaveLength(0)
    expect(canvasEdgeRepository.findByCanvasId('c-1')).toHaveLength(0)
  })

  it('todo cascade — sub-todo도 같은 batch로 묶임', () => {
    seedTodo('parent')
    seedTodo('child-1', 'parent')
    seedTodo('child-2', 'parent')
    seedTodo('grandchild', 'child-1')

    const batchId = trashService.softRemove(WS, 'todo', 'parent')
    const batched = todoRepository.findByTrashBatchId(batchId)
    expect(batched.map((t) => t.id).sort()).toEqual(['child-1', 'child-2', 'grandchild', 'parent'])
  })
})

describe('trashService — restore', () => {
  it('restore 후 활성 list에 다시 보임', () => {
    seedTodo('td-1')
    const batchId = trashService.softRemove(WS, 'todo', 'td-1')
    trashService.restore(batchId)
    expect(todoRepository.findById('td-1')).toBeDefined()
    expect(todoRepository.findByWorkspaceId(WS).map((t) => t.id)).toEqual(['td-1'])
  })

  it('canvas cascade restore — nodes/edges도 함께 복구', () => {
    seedCanvas('c-1')
    seedCanvasNode('n-1', 'c-1')
    seedCanvasNode('n-2', 'c-1')
    testDb
      .insert(schema.canvasEdges)
      .values({
        id: 'e-1',
        canvasId: 'c-1',
        fromNode: 'n-1',
        toNode: 'n-2',
        createdAt: new Date()
      })
      .run()

    const batchId = trashService.softRemove(WS, 'canvas', 'c-1')
    trashService.restore(batchId)
    expect(canvasRepository.findById('c-1')).toBeDefined()
    expect(canvasNodeRepository.findByCanvasId('c-1')).toHaveLength(2)
    expect(canvasEdgeRepository.findByCanvasId('c-1')).toHaveLength(1)
  })

  it('entity-link snapshot 복원', () => {
    seedTodo('td-1')
    seedTodo('td-2')
    // 두 todo 사이 link
    testDb
      .insert(schema.entityLinks)
      .values({
        sourceType: 'todo',
        sourceId: 'td-1',
        targetType: 'todo',
        targetId: 'td-2',
        workspaceId: WS,
        createdAt: new Date()
      })
      .run()

    const batchId = trashService.softRemove(WS, 'todo', 'td-1')
    // softRemove 후 link은 hard delete됨
    expect(entityLinkRepository.findByEntity('todo', 'td-2')).toHaveLength(0)

    trashService.restore(batchId)
    // restore 시 link 복원
    expect(entityLinkRepository.findByEntity('todo', 'td-2')).toHaveLength(1)
  })

  it('존재하지 않는 batchId → NotFoundError', () => {
    expect(() => trashService.restore('bogus-batch')).toThrow()
  })
})

describe('trashService — purge / sweep', () => {
  it('purge — DB row hard delete', () => {
    seedTodo('td-1')
    const batchId = trashService.softRemove(WS, 'todo', 'td-1')
    expect(todoRepository.findByIdIncludingDeleted('td-1')).toBeDefined()

    trashService.purge(batchId)
    expect(todoRepository.findByIdIncludingDeleted('td-1')).toBeUndefined()
  })

  it('sweep — cutoff 이전 batch만 purge', async () => {
    const { eq } = await import('drizzle-orm')
    seedTodo('old-todo')
    seedTodo('new-todo')

    const oldBatchId = trashService.softRemove(WS, 'todo', 'old-todo')
    // old batch의 deletedAt을 인위적으로 과거로 변경 (테스트용)
    const past = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60일 전
    testDb
      .update(schema.trashBatches)
      .set({ deletedAt: past })
      .where(eq(schema.trashBatches.id, oldBatchId))
      .run()

    trashService.softRemove(WS, 'todo', 'new-todo')

    const purgedCount = trashService.sweep(WS, 30 * 24 * 60 * 60 * 1000) // 30일 cutoff
    expect(purgedCount).toBe(1)
    expect(todoRepository.findByIdIncludingDeleted('old-todo')).toBeUndefined()
    expect(todoRepository.findByIdIncludingDeleted('new-todo')).toBeDefined()
  })
})

describe('trashService — list', () => {
  it('휴지통 batch 목록 + 메타', () => {
    seedTodo('td-1', null, 'My Plan')
    seedSchedule('s-1', 'My Meeting')
    trashService.softRemove(WS, 'todo', 'td-1')
    trashService.softRemove(WS, 'schedule', 's-1')

    const result = trashService.list(WS)
    expect(result.batches).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.hasMore).toBe(false)
    const types = result.batches.map((b) => b.rootEntityType).sort()
    expect(types).toEqual(['schedule', 'todo'])
  })

  it('types 필터', () => {
    seedTodo('td-1')
    seedSchedule('s-1')
    trashService.softRemove(WS, 'todo', 'td-1')
    trashService.softRemove(WS, 'schedule', 's-1')

    const onlyTodo = trashService.list(WS, { types: ['todo'] })
    expect(onlyTodo.batches).toHaveLength(1)
    expect(onlyTodo.batches[0].rootEntityType).toBe('todo')
  })

  it('search 필터', () => {
    seedTodo('td-1', null, 'Read book')
    seedTodo('td-2', null, 'Deploy app')
    trashService.softRemove(WS, 'todo', 'td-1')
    trashService.softRemove(WS, 'todo', 'td-2')

    const r = trashService.list(WS, { search: 'read' })
    expect(r.batches).toHaveLength(1)
    expect(r.batches[0].rootTitle).toBe('Read book')
  })

  it('childCount 정확성', () => {
    seedTodo('parent')
    seedTodo('child-1', 'parent')
    seedTodo('child-2', 'parent')
    trashService.softRemove(WS, 'todo', 'parent')
    const r = trashService.list(WS)
    expect(r.batches[0].childCount).toBe(2)
  })
})

describe('trashService — Tier 1 (FS) 차단', () => {
  it('folder/note/csv/pdf/image는 M2에서 ValidationError', () => {
    expect(() => trashService.softRemove(WS, 'note', 'fake-id')).toThrow()
    expect(() => trashService.softRemove(WS, 'folder', 'fake-id')).toThrow()
  })
})

describe('M2-D: service.remove 통합 — 기본 soft delete', () => {
  it('todoService.remove() → 휴지통 이동 (영구 삭제 안 됨)', async () => {
    const { todoService } = await import('../todo')
    seedTodo('td-soft')
    todoService.remove('td-soft')
    expect(todoRepository.findById('td-soft')).toBeUndefined()
    // 휴지통에는 남아있음
    expect(todoRepository.findByIdIncludingDeleted('td-soft')).toBeDefined()
    const list = trashService.list(WS)
    expect(list.batches.some((b) => b.rootEntityId === 'td-soft')).toBe(true)
  })

  it('todoService.remove({ permanent: true }) → 즉시 영구 삭제', async () => {
    const { todoService } = await import('../todo')
    seedTodo('td-hard')
    todoService.remove('td-hard', { permanent: true })
    expect(todoRepository.findByIdIncludingDeleted('td-hard')).toBeUndefined()
    expect(trashService.list(WS).batches.some((b) => b.rootEntityId === 'td-hard')).toBe(false)
  })

  it('canvasService.remove() → 휴지통 이동, 자식 노드 동반', async () => {
    const { canvasService } = await import('../canvas')
    seedCanvas('cv-soft')
    seedCanvasNode('cn-1', 'cv-soft')
    canvasService.remove('cv-soft')
    expect(canvasRepository.findById('cv-soft')).toBeUndefined()
    expect(canvasNodeRepository.findById('cn-1')).toBeUndefined()
    const list = trashService.list(WS)
    expect(list.batches.some((b) => b.rootEntityId === 'cv-soft')).toBe(true)
  })

  it('recurringRuleService.delete() → 휴지통 이동', async () => {
    const { recurringRuleService } = await import('../recurring-rule')
    seedRecurringRule('rr-soft')
    recurringRuleService.delete('rr-soft')
    expect(recurringRuleRepository.findById('rr-soft')).toBeUndefined()
    expect(recurringRuleRepository.findByIdIncludingDeleted('rr-soft')).toBeDefined()
  })

  it('scheduleService.remove() → 휴지통 이동', async () => {
    const { scheduleService } = await import('../schedule')
    seedSchedule('sc-soft')
    scheduleService.remove('sc-soft')
    expect(scheduleRepository.findById('sc-soft')).toBeUndefined()
    expect(scheduleRepository.findByIdIncludingDeleted('sc-soft')).toBeDefined()
  })
})
