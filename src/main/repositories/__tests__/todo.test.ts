import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { todoRepository, type TodoInsert } from '../todo'

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

function makeTodo(overrides?: Partial<TodoInsert>): TodoInsert {
  return {
    id: 'todo-1',
    workspaceId: WS_ID,
    parentId: null,
    title: 'Test Todo',
    description: '',
    status: '할일',
    priority: 'medium',
    isDone: false,
    listOrder: 0,
    kanbanOrder: 0,
    subOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    doneAt: null,
    dueDate: null,
    startDate: null,
    ...overrides
  }
}

describe('findByWorkspaceId', () => {
  it('투두 없을 때 빈 배열 반환', () => {
    expect(todoRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('filter 없음 — 최상위+서브투두 모두 반환', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'parent-1' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'child-1', parentId: 'parent-1' })).run()
    const result = todoRepository.findByWorkspaceId(WS_ID)
    expect(result).toHaveLength(2)
  })

  it("filter='active' — 최상위 미완료 포함", () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 't1', isDone: false, parentId: null })).run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'active')
    expect(result.map((r) => r.id)).toContain('t1')
  })

  it("filter='active' — 최상위 완료 제외", () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 't2', isDone: true, parentId: null })).run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'active')
    expect(result.map((r) => r.id)).not.toContain('t2')
  })

  it("filter='active' — 서브투두 미완료 포함", () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'p1' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'c1', parentId: 'p1', isDone: false })).run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'active')
    expect(result.map((r) => r.id)).toContain('c1')
  })

  it("filter='active' — 서브투두 완료도 포함 (핵심 동작)", () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'p2' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'c2', parentId: 'p2', isDone: true })).run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'active')
    expect(result.map((r) => r.id)).toContain('c2')
  })

  it("filter='completed' — 최상위 완료 포함", () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 't3', isDone: true, parentId: null })).run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'completed')
    expect(result.map((r) => r.id)).toContain('t3')
  })

  it("filter='completed' — 서브투두 완료 제외", () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'p3' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'c3', parentId: 'p3', isDone: true })).run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'completed')
    expect(result.map((r) => r.id)).not.toContain('c3')
  })
})

describe('findById', () => {
  it('존재하는 id → Todo 반환', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'x1' })).run()
    expect(todoRepository.findById('x1')).toBeDefined()
  })
  it('없는 id → undefined', () => {
    expect(todoRepository.findById('none')).toBeUndefined()
  })
})

describe('findByParentId', () => {
  it('해당 parentId 서브투두만 반환 (다른 parentId 배제)', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'p-a' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'p-b' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'c-a1', parentId: 'p-a' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'c-b1', parentId: 'p-b' })).run()
    const result = todoRepository.findByParentId('p-a')
    expect(result.map((r) => r.id)).toEqual(['c-a1'])
  })
})

describe('findTopLevelByWorkspaceId', () => {
  it('parentId=null 항목만 반환', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'top-1', parentId: null })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'sub-1', parentId: 'top-1' })).run()
    const result = todoRepository.findTopLevelByWorkspaceId(WS_ID)
    expect(result.map((r) => r.id)).toEqual(['top-1'])
  })
})

describe('create', () => {
  it('모든 필드 포함하여 생성', () => {
    const row = todoRepository.create(makeTodo({ id: 'new-1', title: 'New' }))
    expect(row.id).toBe('new-1')
    expect(row.title).toBe('New')
    expect(row.isDone).toBe(false)
    expect(row.listOrder).toBe(0)
  })
  it('listOrder는 real 타입 — 소수 저장/읽기 가능', () => {
    const row = todoRepository.create(makeTodo({ id: 'real-1', listOrder: 1.5 }))
    expect(row.listOrder).toBe(1.5)
  })
})

describe('update', () => {
  it('지정 필드만 변경, 나머지 보존', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'u1', title: '원본' })).run()
    const updated = todoRepository.update('u1', { title: '수정' })
    expect(updated?.title).toBe('수정')
    expect(updated?.status).toBe('할일')
  })
  it('없는 id → undefined', () => {
    expect(todoRepository.update('ghost', { title: 'x' })).toBeUndefined()
  })
})

describe('delete', () => {
  it('삭제 후 findById → undefined', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'd1' })).run()
    todoRepository.delete('d1')
    expect(todoRepository.findById('d1')).toBeUndefined()
  })
  it('부모 삭제 시 자식 cascade 삭제', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'par' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'chi', parentId: 'par' })).run()
    todoRepository.delete('par')
    expect(todoRepository.findById('chi')).toBeUndefined()
  })
})

describe('bulkUpdateListOrder', () => {
  it('빈 배열 → no-op', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'b1', listOrder: 5 })).run()
    todoRepository.bulkUpdateListOrder([])
    expect(todoRepository.findById('b1')!.listOrder).toBe(5)
  })
  it('listOrder + updatedAt 변경', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'b2', listOrder: 0 })).run()
    todoRepository.bulkUpdateListOrder([{ id: 'b2', order: 99 }])
    expect(todoRepository.findById('b2')!.listOrder).toBe(99)
  })
})

describe('bulkUpdateKanbanOrder', () => {
  it('빈 배열 → no-op', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'k1' })).run()
    todoRepository.bulkUpdateKanbanOrder([])
    expect(todoRepository.findById('k1')!.kanbanOrder).toBe(0)
  })
  it("status='완료' 포함 → isDone=true, doneAt≠null (Drizzle Date로 읽힘)", () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'k2', status: '할일', isDone: false })).run()
    const now = Date.now()
    todoRepository.bulkUpdateKanbanOrder([{ id: 'k2', order: 1, status: '완료', isDone: true, doneAt: now }])
    const row = todoRepository.findById('k2')!
    expect(row.isDone).toBe(true)
    expect(row.status).toBe('완료')
    expect(row.doneAt).toBeInstanceOf(Date)
  })
  it("status='할일' 포함 → isDone=false, doneAt=null", () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'k3', status: '완료', isDone: true, doneAt: new Date() }))
      .run()
    todoRepository.bulkUpdateKanbanOrder([{ id: 'k3', order: 1, status: '할일', isDone: false, doneAt: null }])
    const row = todoRepository.findById('k3')!
    expect(row.isDone).toBe(false)
    expect(row.doneAt).toBeNull()
  })
  it('status 없이 order만 전달 → kanbanOrder만 변경', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'k4', isDone: false })).run()
    todoRepository.bulkUpdateKanbanOrder([{ id: 'k4', order: 7 }])
    const row = todoRepository.findById('k4')!
    expect(row.kanbanOrder).toBe(7)
    expect(row.isDone).toBe(false)
  })
})

describe('findAllDescendantIds', () => {
  it('자식 없는 todo → 빈 배열', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'leaf' })).run()
    expect(todoRepository.findAllDescendantIds('leaf')).toEqual([])
  })

  it('1단계 자식 → 자식 ID 배열', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'parent' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'child-1', parentId: 'parent' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'child-2', parentId: 'parent' })).run()
    const result = todoRepository.findAllDescendantIds('parent')
    expect(result).toHaveLength(2)
    expect(result).toContain('child-1')
    expect(result).toContain('child-2')
  })

  it('다단계 (parent→child→grandchild) → 모든 하위 ID', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 'p' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'c', parentId: 'p' })).run()
    testDb.insert(schema.todos).values(makeTodo({ id: 'gc', parentId: 'c' })).run()
    const result = todoRepository.findAllDescendantIds('p')
    expect(result).toHaveLength(2)
    expect(result).toContain('c')
    expect(result).toContain('gc')
  })

  it('존재하지 않는 parentId → 빈 배열', () => {
    expect(todoRepository.findAllDescendantIds('non-exist')).toEqual([])
  })
})

describe('bulkUpdateSubOrder', () => {
  it('빈 배열 → no-op', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 's1', subOrder: 0 })).run()
    todoRepository.bulkUpdateSubOrder([])
    expect(todoRepository.findById('s1')!.subOrder).toBe(0)
  })
  it('subOrder 변경', () => {
    testDb.insert(schema.todos).values(makeTodo({ id: 's2', subOrder: 0 })).run()
    todoRepository.bulkUpdateSubOrder([{ id: 's2', order: 3 }])
    expect(todoRepository.findById('s2')!.subOrder).toBe(3)
  })
})
