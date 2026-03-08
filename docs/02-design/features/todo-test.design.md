# Design: Todo 테스트 코드 작성

> 작성일: 2026-02-28
> 기능: todo-test
> 레벨: Dynamic
> Plan 참조: `docs/01-plan/features/todo-test.plan.md`

---

## 1. 전체 구조

```
src/main/
  repositories/__tests__/todo.test.ts        ← [A] DB 직접 검증
  services/__tests__/todo.test.ts             ← [B] repository 전체 mock

src/renderer/src/
  features/todo/
    filter-todo/model/__tests__/todo-filter.test.ts     ← [C] 순수 함수
    todo-list/model/__tests__/use-todo-list.test.ts     ← [D] renderHook + act
    todo-kanban/model/__tests__/use-todo-kanban.test.ts ← [E] renderHook + act
    todo-list/model/__tests__/use-completed-todo-list.test.ts ← [F] renderHook + rerender
  entities/todo/model/__tests__/queries.test.ts          ← [G] QueryClient + waitFor
```

---

## 2. 공통 픽스처 / Mock 정의

### 2-1. `MOCK_TODO_ITEM` (Renderer용 — `TodoItem` 타입)

```typescript
import type { TodoItem } from '@entities/todo'
import { DEFAULT_FILTER } from '../../filter-todo/model/todo-filter'

const BASE_TODO: TodoItem = {
  id: 'todo-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Test',
  description: '',
  status: '할일',
  priority: 'medium',
  isDone: false,
  listOrder: 0,
  kanbanOrder: 0,
  subOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  doneAt: null,
  dueDate: null
}

function makeTodoItem(overrides?: Partial<TodoItem>): TodoItem {
  return { ...BASE_TODO, ...overrides }
}
```

### 2-2. `MOCK_TODO_ROW` (Main Process용 — `Todo` DB 타입)

```typescript
// src/main/services/__tests__/todo.test.ts
const MOCK_TODO_ROW = {
  id: 'todo-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Test',
  description: '',
  status: '할일' as const,
  priority: 'medium' as const,
  isDone: false,
  listOrder: 0,
  kanbanOrder: 0,
  subOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  doneAt: null,
  dueDate: null
}
```

---

## 3. [A] todoRepository 테스트

**파일**: `src/main/repositories/__tests__/todo.test.ts`

```typescript
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
    ...overrides
  }
}
```

### 3-1. `findByWorkspaceId`

```typescript
describe('findByWorkspaceId', () => {
  it('투두 없을 때 빈 배열 반환', () => {
    expect(todoRepository.findByWorkspaceId(WS_ID)).toEqual([])
  })

  it('filter 없음 — 최상위+서브투두 모두 반환', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'parent-1' }))
      .run()
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'child-1', parentId: 'parent-1' }))
      .run()
    const result = todoRepository.findByWorkspaceId(WS_ID)
    expect(result).toHaveLength(2)
  })

  it("filter='active' — 최상위 미완료 포함", () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 't1', isDone: false, parentId: null }))
      .run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'active')
    expect(result.map((r) => r.id)).toContain('t1')
  })

  it("filter='active' — 최상위 완료 제외", () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 't2', isDone: true, parentId: null }))
      .run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'active')
    expect(result.map((r) => r.id)).not.toContain('t2')
  })

  it("filter='active' — 서브투두 미완료 포함", () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'p1' }))
      .run()
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'c1', parentId: 'p1', isDone: false }))
      .run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'active')
    expect(result.map((r) => r.id)).toContain('c1')
  })

  it("filter='active' — 서브투두 완료도 포함 (핵심 동작)", () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'p2' }))
      .run()
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'c2', parentId: 'p2', isDone: true }))
      .run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'active')
    expect(result.map((r) => r.id)).toContain('c2')
  })

  it("filter='completed' — 최상위 완료 포함", () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 't3', isDone: true, parentId: null }))
      .run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'completed')
    expect(result.map((r) => r.id)).toContain('t3')
  })

  it("filter='completed' — 서브투두 완료 제외", () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'p3' }))
      .run()
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'c3', parentId: 'p3', isDone: true }))
      .run()
    const result = todoRepository.findByWorkspaceId(WS_ID, 'completed')
    expect(result.map((r) => r.id)).not.toContain('c3')
  })
})
```

### 3-2. `findById` / `findByParentId` / `findTopLevelByWorkspaceId`

```typescript
describe('findById', () => {
  it('존재하는 id → Todo 반환', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'x1' }))
      .run()
    expect(todoRepository.findById('x1')).toBeDefined()
  })
  it('없는 id → undefined', () => {
    expect(todoRepository.findById('none')).toBeUndefined()
  })
})

describe('findByParentId', () => {
  it('해당 parentId 서브투두만 반환 (다른 parentId 배제)', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'p-a' }))
      .run()
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'p-b' }))
      .run()
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'c-a1', parentId: 'p-a' }))
      .run()
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'c-b1', parentId: 'p-b' }))
      .run()
    const result = todoRepository.findByParentId('p-a')
    expect(result.map((r) => r.id)).toEqual(['c-a1'])
  })
})

describe('findTopLevelByWorkspaceId', () => {
  it('parentId=null 항목만 반환', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'top-1', parentId: null }))
      .run()
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'sub-1', parentId: 'top-1' }))
      .run()
    const result = todoRepository.findTopLevelByWorkspaceId(WS_ID)
    expect(result.map((r) => r.id)).toEqual(['top-1'])
  })
})
```

### 3-3. `create` / `update` / `delete`

```typescript
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
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'u1', title: '원본' }))
      .run()
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
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'd1' }))
      .run()
    todoRepository.delete('d1')
    expect(todoRepository.findById('d1')).toBeUndefined()
  })
  it('부모 삭제 시 자식 cascade 삭제', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'par' }))
      .run()
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'chi', parentId: 'par' }))
      .run()
    todoRepository.delete('par')
    expect(todoRepository.findById('chi')).toBeUndefined()
  })
})
```

### 3-4. `bulkUpdate*`

```typescript
describe('bulkUpdateListOrder', () => {
  it('빈 배열 → no-op', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'b1', listOrder: 5 }))
      .run()
    todoRepository.bulkUpdateListOrder([])
    expect(todoRepository.findById('b1')!.listOrder).toBe(5)
  })
  it('listOrder + updatedAt 변경', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'b2', listOrder: 0 }))
      .run()
    todoRepository.bulkUpdateListOrder([{ id: 'b2', order: 99 }])
    expect(todoRepository.findById('b2')!.listOrder).toBe(99)
  })
})

describe('bulkUpdateKanbanOrder', () => {
  it('빈 배열 → no-op', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'k1' }))
      .run()
    todoRepository.bulkUpdateKanbanOrder([])
    expect(todoRepository.findById('k1')!.kanbanOrder).toBe(0)
  })
  it("status='완료' 포함 → isDone=true, doneAt≠null (Drizzle Date로 읽힘)", () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'k2', status: '할일', isDone: false }))
      .run()
    const now = Date.now()
    todoRepository.bulkUpdateKanbanOrder([
      { id: 'k2', order: 1, status: '완료', isDone: true, doneAt: now }
    ])
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
    todoRepository.bulkUpdateKanbanOrder([
      { id: 'k3', order: 1, status: '할일', isDone: false, doneAt: null }
    ])
    const row = todoRepository.findById('k3')!
    expect(row.isDone).toBe(false)
    expect(row.doneAt).toBeNull()
  })
  it('status 없이 order만 전달 → kanbanOrder만 변경', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 'k4', isDone: false }))
      .run()
    todoRepository.bulkUpdateKanbanOrder([{ id: 'k4', order: 7 }])
    const row = todoRepository.findById('k4')!
    expect(row.kanbanOrder).toBe(7)
    expect(row.isDone).toBe(false)
  })
})

describe('bulkUpdateSubOrder', () => {
  it('빈 배열 → no-op', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 's1', subOrder: 0 }))
      .run()
    todoRepository.bulkUpdateSubOrder([])
    expect(todoRepository.findById('s1')!.subOrder).toBe(0)
  })
  it('subOrder 변경', () => {
    testDb
      .insert(schema.todos)
      .values(makeTodo({ id: 's2', subOrder: 0 }))
      .run()
    todoRepository.bulkUpdateSubOrder([{ id: 's2', order: 3 }])
    expect(todoRepository.findById('s2')!.subOrder).toBe(3)
  })
})
```

---

## 4. [B] todoService 테스트

**파일**: `src/main/services/__tests__/todo.test.ts`

### 4-1. Mock 설정 + 공통 픽스처

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { todoService } from '../todo'
import { todoRepository } from '../../repositories/todo'
import { workspaceRepository } from '../../repositories/workspace'
import { NotFoundError } from '../../lib/errors'

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/todo', () => ({
  todoRepository: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    findByParentId: vi.fn(),
    findTopLevelByWorkspaceId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkUpdateListOrder: vi.fn(),
    bulkUpdateKanbanOrder: vi.fn(),
    bulkUpdateSubOrder: vi.fn()
  }
}))

const MOCK_WS = { id: 'ws-1', name: 'T', path: '/t', createdAt: new Date(), updatedAt: new Date() }

const MOCK_TODO_ROW = {
  id: 'todo-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Test',
  description: '',
  status: '할일' as const,
  priority: 'medium' as const,
  isDone: false,
  listOrder: 0,
  kanbanOrder: 0,
  subOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  doneAt: null,
  dueDate: null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  vi.mocked(todoRepository.create).mockReturnValue(MOCK_TODO_ROW)
  vi.mocked(todoRepository.update).mockReturnValue(MOCK_TODO_ROW)
  vi.mocked(todoRepository.findByWorkspaceId).mockReturnValue([MOCK_TODO_ROW])
  vi.mocked(todoRepository.findById).mockReturnValue(MOCK_TODO_ROW)
  vi.mocked(todoRepository.findTopLevelByWorkspaceId).mockReturnValue([])
  vi.mocked(todoRepository.findByParentId).mockReturnValue([])
})
```

### 4-2. `findByWorkspace`

```typescript
describe('findByWorkspace', () => {
  it('정상 — todoRepository.findByWorkspaceId 호출 후 TodoItem[] 반환', () => {
    const result = todoService.findByWorkspace('ws-1')
    expect(todoRepository.findByWorkspaceId).toHaveBeenCalledWith('ws-1', undefined)
    expect(result).toHaveLength(1)
  })
  it('존재하지 않는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.findByWorkspace('bad-ws')).toThrow(NotFoundError)
  })
})
```

### 4-3. `create`

```typescript
describe('create', () => {
  it('최상위 생성 — findTopLevelByWorkspaceId 호출, findById 미호출', () => {
    todoService.create('ws-1', { title: '할일' })
    expect(todoRepository.findTopLevelByWorkspaceId).toHaveBeenCalledWith('ws-1')
    expect(todoRepository.findById).not.toHaveBeenCalled()
  })

  it('서브투두 생성 — findByParentId 호출, findTopLevelByWorkspaceId 미호출', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(MOCK_TODO_ROW) // parent 존재
    todoService.create('ws-1', { title: '서브', parentId: 'todo-1' })
    expect(todoRepository.findByParentId).toHaveBeenCalledWith('todo-1')
    expect(todoRepository.findTopLevelByWorkspaceId).not.toHaveBeenCalled()
  })

  it('형제 없을 때 — listOrder=kanbanOrder=subOrder=0', () => {
    vi.mocked(todoRepository.findTopLevelByWorkspaceId).mockReturnValue([])
    todoService.create('ws-1', { title: '첫 투두' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ listOrder: 0, kanbanOrder: 0, subOrder: 0 })
    )
  })

  it('형제 있을 때 (max listOrder=2) — listOrder=3', () => {
    vi.mocked(todoRepository.findTopLevelByWorkspaceId).mockReturnValue([
      { ...MOCK_TODO_ROW, id: 'sib-1', listOrder: 1, kanbanOrder: 1, subOrder: 1 },
      { ...MOCK_TODO_ROW, id: 'sib-2', listOrder: 2, kanbanOrder: 2, subOrder: 2 }
    ])
    todoService.create('ws-1', { title: '세 번째' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ listOrder: 3, kanbanOrder: 3, subOrder: 3 })
    )
  })

  it("status='완료'로 생성 — isDone=true, doneAt=expect.any(Date)", () => {
    todoService.create('ws-1', { title: '완료', status: '완료' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isDone: true, doneAt: expect.any(Date) })
    )
  })

  it('기본 status 생성 — isDone=false, doneAt=null', () => {
    todoService.create('ws-1', { title: '할일' })
    expect(todoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isDone: false, doneAt: null })
    )
  })

  it("title='  제목  ' — trim 적용", () => {
    todoService.create('ws-1', { title: '  제목  ' })
    expect(todoRepository.create).toHaveBeenCalledWith(expect.objectContaining({ title: '제목' }))
  })

  it('description 미전달 — description=""', () => {
    todoService.create('ws-1', { title: '제목' })
    expect(todoRepository.create).toHaveBeenCalledWith(expect.objectContaining({ description: '' }))
  })

  it('없는 parentId → NotFoundError', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.create('ws-1', { title: 't', parentId: 'ghost' })).toThrow(
      NotFoundError
    )
  })

  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.create('bad', { title: 't' })).toThrow(NotFoundError)
  })
})
```

### 4-4. `update` — resolveDoneFields

```typescript
describe('update', () => {
  it('{isDone:true} → status=완료, doneAt=Date', () => {
    todoService.update('todo-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: true, status: '완료', doneAt: expect.any(Date) })
    )
  })

  it('{isDone:false} → status=할일, doneAt=null', () => {
    todoService.update('todo-1', { isDone: false })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: false, status: '할일', doneAt: null })
    )
  })

  it("{status:'완료'} → isDone=true, doneAt=Date", () => {
    todoService.update('todo-1', { status: '완료' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: true, status: '완료', doneAt: expect.any(Date) })
    )
  })

  it("{status:'진행중'} → isDone=false, doneAt=null", () => {
    todoService.update('todo-1', { status: '진행중' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: false, status: '진행중', doneAt: null })
    )
  })

  it("{status:'보류'} → isDone=false, doneAt=null", () => {
    todoService.update('todo-1', { status: '보류' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: false, status: '보류', doneAt: null })
    )
  })

  it('{title만} → isDone/status/doneAt 필드 포함 안 됨', () => {
    todoService.update('todo-1', { title: '새 제목' })
    const arg = vi.mocked(todoRepository.update).mock.calls[0][1]
    expect(arg).not.toHaveProperty('isDone')
    expect(arg).not.toHaveProperty('status')
    expect(arg).not.toHaveProperty('doneAt')
  })

  it('{isDone:false, status:진행중} → isDone 우선, status=할일로 강제', () => {
    todoService.update('todo-1', { isDone: false, status: '진행중' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ isDone: false, status: '할일' })
    )
  })

  it("{title:'  수정  '} → title trim 적용", () => {
    todoService.update('todo-1', { title: '  수정  ' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ title: '수정' })
    )
  })

  it("{description:'  설명  '} → description trim 적용", () => {
    todoService.update('todo-1', { description: '  설명  ' })
    expect(todoRepository.update).toHaveBeenCalledWith(
      'todo-1',
      expect.objectContaining({ description: '설명' })
    )
  })

  it('없는 todoId → NotFoundError (findById 단계)', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.update('ghost', { title: 'x' })).toThrow(NotFoundError)
  })

  it('update 반환 undefined → NotFoundError (update 단계)', () => {
    vi.mocked(todoRepository.update).mockReturnValue(undefined)
    expect(() => todoService.update('todo-1', { title: 'x' })).toThrow(NotFoundError)
  })
})
```

### 4-5. 부모 자동완료

```typescript
describe('부모 자동완료', () => {
  const subTodo = { ...MOCK_TODO_ROW, id: 'sub-1', parentId: 'par-1' }
  const parentTodo = { ...MOCK_TODO_ROW, id: 'par-1' }

  it('서브투두 완료 + 모든 형제 완료 → update 2회 (부모 자동완료)', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(subTodo)
    vi.mocked(todoRepository.update).mockReturnValue(subTodo)
    // 형제들이 모두 완료 상태
    vi.mocked(todoRepository.findByParentId).mockReturnValue([
      { ...subTodo, id: 'sub-1', isDone: false }, // 현재 업데이트 대상 (true로 처리)
      { ...subTodo, id: 'sub-2', isDone: true }
    ])
    todoService.update('sub-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledTimes(2)
    // 두 번째 호출이 부모 자동완료
    expect(todoRepository.update).toHaveBeenNthCalledWith(
      2,
      'par-1',
      expect.objectContaining({ isDone: true, status: '완료' })
    )
  })

  it('서브투두 완료 + 미완료 형제 있음 → update 1회', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(subTodo)
    vi.mocked(todoRepository.update).mockReturnValue(subTodo)
    vi.mocked(todoRepository.findByParentId).mockReturnValue([
      { ...subTodo, id: 'sub-1', isDone: false },
      { ...subTodo, id: 'sub-2', isDone: false } // 미완료 형제
    ])
    todoService.update('sub-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledTimes(1)
  })

  it('서브투두 단독 (형제 없음) → update 2회 (always allDone=true)', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(subTodo)
    vi.mocked(todoRepository.update).mockReturnValue(subTodo)
    vi.mocked(todoRepository.findByParentId).mockReturnValue([
      { ...subTodo, id: 'sub-1', isDone: false } // 본인만 존재
    ])
    todoService.update('sub-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledTimes(2)
  })

  it('최상위 투두 완료 → update 1회, findByParentId 미호출', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(parentTodo) // parentId=null
    vi.mocked(todoRepository.update).mockReturnValue(parentTodo)
    todoService.update('par-1', { isDone: true })
    expect(todoRepository.update).toHaveBeenCalledTimes(1)
    expect(todoRepository.findByParentId).not.toHaveBeenCalled()
  })

  it("status='완료' 업데이트도 부모 자동완료 트리거", () => {
    vi.mocked(todoRepository.findById).mockReturnValue(subTodo)
    vi.mocked(todoRepository.update).mockReturnValue(subTodo)
    vi.mocked(todoRepository.findByParentId).mockReturnValue([
      { ...subTodo, id: 'sub-1', isDone: false }
    ])
    todoService.update('sub-1', { status: '완료' })
    expect(todoRepository.update).toHaveBeenCalledTimes(2)
  })
})
```

### 4-6. `remove` / `reorderList` / `reorderKanban` / `reorderSub`

```typescript
describe('remove', () => {
  it('정상 삭제 → todoRepository.delete 1회', () => {
    todoService.remove('todo-1')
    expect(todoRepository.delete).toHaveBeenCalledWith('todo-1')
    expect(todoRepository.delete).toHaveBeenCalledTimes(1)
  })
  it('없는 todoId → NotFoundError', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.remove('ghost')).toThrow(NotFoundError)
  })
})

describe('reorderList', () => {
  it('bulkUpdateListOrder 호출', () => {
    todoService.reorderList('ws-1', [{ id: 'todo-1', order: 5 }])
    expect(todoRepository.bulkUpdateListOrder).toHaveBeenCalledWith([{ id: 'todo-1', order: 5 }])
  })
  it('없는 workspaceId → NotFoundError', () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.reorderList('bad', [])).toThrow(NotFoundError)
  })
})

describe('reorderKanban', () => {
  it("status='완료' — bulkUpdateKanbanOrder에 isDone=true, doneAt=number 전달", () => {
    todoService.reorderKanban('ws-1', [{ id: 'todo-1', order: 1, status: '완료' }])
    expect(todoRepository.bulkUpdateKanbanOrder).toHaveBeenCalledWith([
      expect.objectContaining({ isDone: true, doneAt: expect.any(Number) })
    ])
  })
  it("status='할일' — isDone=false, doneAt=null 전달", () => {
    todoService.reorderKanban('ws-1', [{ id: 'todo-1', order: 1, status: '할일' }])
    expect(todoRepository.bulkUpdateKanbanOrder).toHaveBeenCalledWith([
      expect.objectContaining({ isDone: false, doneAt: null })
    ])
  })
  it('status 없음 — {id, order}만 전달', () => {
    todoService.reorderKanban('ws-1', [{ id: 'todo-1', order: 1 }])
    expect(todoRepository.bulkUpdateKanbanOrder).toHaveBeenCalledWith([{ id: 'todo-1', order: 1 }])
  })
})

describe('reorderSub', () => {
  it('bulkUpdateSubOrder 호출', () => {
    todoService.reorderSub('todo-1', [{ id: 'sub-1', order: 2 }])
    expect(todoRepository.bulkUpdateSubOrder).toHaveBeenCalledWith([{ id: 'sub-1', order: 2 }])
  })
  it('없는 parentId → NotFoundError', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.reorderSub('ghost', [])).toThrow(NotFoundError)
  })
})
```

### 4-7. toTodoItem Date 변환

```typescript
describe('toTodoItem Date 변환', () => {
  it('createdAt/updatedAt → Date 인스턴스 (number 입력)', () => {
    const numericRow = {
      ...MOCK_TODO_ROW,
      createdAt: 1700000000000 as unknown as Date,
      updatedAt: 1700000000000 as unknown as Date
    }
    vi.mocked(todoRepository.findById).mockReturnValue(numericRow)
    vi.mocked(todoRepository.update).mockReturnValue(numericRow)
    const result = todoService.update('todo-1', { title: 'x' })
    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)
  })
  it('isDone=true → doneAt은 Date 인스턴스', () => {
    const doneRow = { ...MOCK_TODO_ROW, isDone: true, doneAt: 1700000000000 as unknown as Date }
    vi.mocked(todoRepository.update).mockReturnValue(doneRow)
    const result = todoService.update('todo-1', { isDone: true })
    expect(result.doneAt).toBeInstanceOf(Date)
  })
  it('isDone=false → doneAt=null', () => {
    const undoneRow = { ...MOCK_TODO_ROW, isDone: false, doneAt: null }
    vi.mocked(todoRepository.update).mockReturnValue(undoneRow)
    const result = todoService.update('todo-1', { isDone: false })
    expect(result.doneAt).toBeNull()
  })
})
```

---

## 5. [C] todo-filter 순수 함수 테스트

**파일**: `src/renderer/src/features/todo/filter-todo/model/__tests__/todo-filter.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FILTER,
  isFilterActive,
  filterToParams,
  filterFromParams,
  applyFilter,
  type TodoFilter
} from '../todo-filter'
import type { TodoItem } from '@entities/todo'

function makeTodoItem(overrides?: Partial<TodoItem>): TodoItem {
  return {
    id: 't1',
    workspaceId: 'ws',
    parentId: null,
    title: 'Test',
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
    ...overrides
  }
}
```

### 5-1. `isFilterActive`

```typescript
describe('isFilterActive', () => {
  it('DEFAULT_FILTER → false', () => expect(isFilterActive(DEFAULT_FILTER)).toBe(false))
  it("status='할일' → true", () =>
    expect(isFilterActive({ ...DEFAULT_FILTER, status: '할일' })).toBe(true))
  it("priority='high' → true", () =>
    expect(isFilterActive({ ...DEFAULT_FILTER, priority: 'high' })).toBe(true))
  it('dueDateFrom 설정 → true', () =>
    expect(isFilterActive({ ...DEFAULT_FILTER, dueDateFrom: new Date() })).toBe(true))
  it('dueDateTo 설정 → true', () =>
    expect(isFilterActive({ ...DEFAULT_FILTER, dueDateTo: new Date() })).toBe(true))
})
```

### 5-2. `filterToParams` / `filterFromParams`

```typescript
describe('filterFromParams', () => {
  it('undefined → DEFAULT_FILTER', () => {
    expect(filterFromParams(undefined, 'k')).toEqual(DEFAULT_FILTER)
  })
  it('빈 객체 {} → DEFAULT_FILTER', () => {
    expect(filterFromParams({}, 'k')).toEqual(DEFAULT_FILTER)
  })
  it("kStatus='' → status='all' (빈 문자열 fallback)", () => {
    expect(filterFromParams({ kStatus: '' }, 'k').status).toBe('all')
  })
})

describe('roundtrip filterToParams → filterFromParams', () => {
  it('날짜 없는 필터 roundtrip', () => {
    const filter: TodoFilter = {
      status: '할일',
      priority: 'high',
      dueDateFrom: null,
      dueDateTo: null
    }
    expect(filterFromParams(filterToParams(filter, 'k'), 'k')).toEqual(filter)
  })
  it('날짜 포함 필터 roundtrip', () => {
    const filter: TodoFilter = {
      status: 'all',
      priority: 'all',
      dueDateFrom: new Date('2026-01-01'),
      dueDateTo: new Date('2026-01-31')
    }
    expect(filterFromParams(filterToParams(filter, 'k'), 'k')).toEqual(filter)
  })
  it('null 날짜 roundtrip → null 복원', () => {
    const filter = { ...DEFAULT_FILTER }
    const params = filterToParams(filter, 'k')
    expect(params.kDueDateFrom).toBe('')
    expect(filterFromParams(params, 'k').dueDateFrom).toBeNull()
  })
})
```

### 5-3. `applyFilter`

```typescript
describe('applyFilter', () => {
  it('DEFAULT_FILTER → 전체 반환', () => {
    const todos = [makeTodoItem(), makeTodoItem({ id: 't2', status: '완료' })]
    expect(applyFilter(todos, DEFAULT_FILTER)).toHaveLength(2)
  })

  it("status='할일' → 해당 status만", () => {
    const todos = [makeTodoItem({ status: '할일' }), makeTodoItem({ id: 't2', status: '완료' })]
    const result = applyFilter(todos, { ...DEFAULT_FILTER, status: '할일' })
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('할일')
  })

  it("priority='high' → 해당 priority만", () => {
    const todos = [makeTodoItem({ priority: 'high' }), makeTodoItem({ id: 't2', priority: 'low' })]
    expect(applyFilter(todos, { ...DEFAULT_FILTER, priority: 'high' })).toHaveLength(1)
  })

  it('dueDateFrom 설정 + dueDate 있음 → 포함', () => {
    const from = new Date('2026-01-10')
    const todo = makeTodoItem({ dueDate: new Date('2026-01-15') })
    expect(applyFilter([todo], { ...DEFAULT_FILTER, dueDateFrom: from })).toHaveLength(1)
  })

  it('dueDateFrom 설정 + dueDate=null → 제외', () => {
    const from = new Date('2026-01-10')
    const todo = makeTodoItem({ dueDate: null })
    expect(applyFilter([todo], { ...DEFAULT_FILTER, dueDateFrom: from })).toHaveLength(0)
  })

  it('dueDateTo 설정 → end-of-day 23:59:59.999 포함', () => {
    const to = new Date('2026-01-31')
    const todo = makeTodoItem({ dueDate: new Date('2026-01-31T23:59:00') })
    expect(applyFilter([todo], { ...DEFAULT_FILTER, dueDateTo: to })).toHaveLength(1)
  })

  it('dueDateTo 설정 + dueDate=null → 제외', () => {
    const to = new Date('2026-01-31')
    const todo = makeTodoItem({ dueDate: null })
    expect(applyFilter([todo], { ...DEFAULT_FILTER, dueDateTo: to })).toHaveLength(0)
  })

  it('status + priority 복합 필터 (AND 적용)', () => {
    const todos = [
      makeTodoItem({ status: '할일', priority: 'high' }),
      makeTodoItem({ id: 't2', status: '할일', priority: 'low' }),
      makeTodoItem({ id: 't3', status: '완료', priority: 'high' })
    ]
    const result = applyFilter(todos, { ...DEFAULT_FILTER, status: '할일', priority: 'high' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })
})
```

---

## 6. [D] useTodoList hook 테스트

**파일**: `src/renderer/src/features/todo/todo-list/model/__tests__/use-todo-list.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTodoList } from '../use-todo-list'
import { DEFAULT_FILTER } from '../../../filter-todo/model/todo-filter'
import type { TodoItem } from '@entities/todo'

const BASE_TODO: TodoItem = {
  id: 'todo-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Test',
  description: '',
  status: '할일',
  priority: 'medium',
  isDone: false,
  listOrder: 0,
  kanbanOrder: 0,
  subOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  doneAt: null,
  dueDate: null
}

function makeTodoItem(overrides?: Partial<TodoItem>): TodoItem {
  return { ...BASE_TODO, ...overrides }
}

describe('useTodoList', () => {
  it('빈 allTodos → filteredTopLevel=[], subTodoMap.size=0, filterActive=false', () => {
    const { result } = renderHook(() => useTodoList([], DEFAULT_FILTER))
    expect(result.current.filteredTopLevel).toEqual([])
    expect(result.current.subTodoMap.size).toBe(0)
    expect(result.current.filterActive).toBe(false)
  })

  it('topLevel — parentId=null 항목만 포함', () => {
    const todos = [
      makeTodoItem({ id: 'p1', parentId: null }),
      makeTodoItem({ id: 'c1', parentId: 'p1' })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    expect(result.current.filteredTopLevel.map((t) => t.id)).toEqual(['p1'])
  })

  it('subTodoMap — subOrder ASC 정렬', () => {
    const todos = [
      makeTodoItem({ id: 'p1' }),
      makeTodoItem({ id: 'c2', parentId: 'p1', subOrder: 2 }),
      makeTodoItem({ id: 'c1', parentId: 'p1', subOrder: 1 })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    const children = result.current.subTodoMap.get('p1')!
    expect(children.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('subTodoMap — 필터 적용 후에도 서브투두 포함 (비필터 동작)', () => {
    const todos = [
      makeTodoItem({ id: 'p-low', priority: 'low' }),
      makeTodoItem({ id: 'c1', parentId: 'p-low', priority: 'low' })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    act(() => {
      result.current.setFilter({ ...DEFAULT_FILTER, priority: 'high' })
    })
    // filteredTopLevel에서 p-low는 제외
    expect(result.current.filteredTopLevel).toHaveLength(0)
    // 하지만 subTodoMap에는 여전히 포함
    expect(result.current.subTodoMap.get('p-low')).toHaveLength(1)
  })

  it('filteredTopLevel — listOrder ASC 정렬', () => {
    const todos = [
      makeTodoItem({ id: 't2', listOrder: 2 }),
      makeTodoItem({ id: 't0', listOrder: 0 }),
      makeTodoItem({ id: 't1', listOrder: 1 })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    expect(result.current.filteredTopLevel.map((t) => t.id)).toEqual(['t0', 't1', 't2'])
  })

  describe('filterActive', () => {
    it('DEFAULT_FILTER → false', () => {
      const { result } = renderHook(() => useTodoList([]))
      expect(result.current.filterActive).toBe(false)
    })
    it("status='할일' → true (useTodoKanban과 다름)", () => {
      const { result } = renderHook(() => useTodoList([], { ...DEFAULT_FILTER, status: '할일' }))
      expect(result.current.filterActive).toBe(true)
    })
    it("priority='high' → true", () => {
      const { result } = renderHook(() => useTodoList([], { ...DEFAULT_FILTER, priority: 'high' }))
      expect(result.current.filterActive).toBe(true)
    })
  })

  it('setFilter 호출 → filteredTopLevel 재계산', () => {
    const todos = [
      makeTodoItem({ id: 't-high', priority: 'high' }),
      makeTodoItem({ id: 't-low', priority: 'low' })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    expect(result.current.filteredTopLevel).toHaveLength(2)
    act(() => {
      result.current.setFilter({ ...DEFAULT_FILTER, priority: 'high' })
    })
    expect(result.current.filteredTopLevel).toHaveLength(1)
    expect(result.current.filteredTopLevel[0].id).toBe('t-high')
  })
})
```

---

## 7. [E] useTodoKanban hook 테스트

**파일**: `src/renderer/src/features/todo/todo-kanban/model/__tests__/use-todo-kanban.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { TodoItem } from '@entities/todo'
import { useTodoKanban } from '../use-todo-kanban'
import { DEFAULT_FILTER } from '../../../filter-todo/model/todo-filter'

const BASE_TODO: TodoItem = {
  id: 'todo-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Test',
  description: '',
  status: '할일',
  priority: 'medium',
  isDone: false,
  listOrder: 0,
  kanbanOrder: 0,
  subOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  doneAt: null,
  dueDate: null
}

function makeTodoItem(overrides?: Partial<TodoItem>): TodoItem {
  return { ...BASE_TODO, ...overrides }
}

describe('useTodoKanban', () => {
  it('빈 allTodos → 4개 컬럼 모두 [] (undefined 아님)', () => {
    const { result } = renderHook(() => useTodoKanban([]))
    expect(result.current.columnMap.get('할일')).toEqual([])
    expect(result.current.columnMap.get('진행중')).toEqual([])
    expect(result.current.columnMap.get('완료')).toEqual([])
    expect(result.current.columnMap.get('보류')).toEqual([])
    expect(result.current.subTodoMap.size).toBe(0)
  })

  it('columnMap — 4개 키 항상 존재', () => {
    const { result } = renderHook(() => useTodoKanban([]))
    expect(result.current.columnMap.size).toBe(4)
  })

  it('columnMap — status별 kanbanOrder ASC 정렬', () => {
    const todos = [
      makeTodoItem({ id: 't2', status: '할일', kanbanOrder: 2 }),
      makeTodoItem({ id: 't1', status: '할일', kanbanOrder: 1 })
    ]
    const { result } = renderHook(() => useTodoKanban(todos))
    expect(result.current.columnMap.get('할일')!.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('subTodoMap — kanbanOrder ASC 정렬 (subOrder 아님)', () => {
    const todos = [
      makeTodoItem({ id: 'p1' }),
      makeTodoItem({ id: 'c2', parentId: 'p1', kanbanOrder: 2, subOrder: 1 }),
      makeTodoItem({ id: 'c1', parentId: 'p1', kanbanOrder: 1, subOrder: 2 })
    ]
    const { result } = renderHook(() => useTodoKanban(todos))
    expect(result.current.subTodoMap.get('p1')!.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('subTodoMap — 필터에서 제외된 부모의 서브투두도 포함', () => {
    const todos = [
      makeTodoItem({ id: 'p-low', status: '할일', priority: 'low' }),
      makeTodoItem({ id: 'c1', parentId: 'p-low' })
    ]
    const { result } = renderHook(() =>
      useTodoKanban(todos, 0, { ...DEFAULT_FILTER, priority: 'high' })
    )
    expect(result.current.columnMap.get('할일')).toHaveLength(0)
    expect(result.current.subTodoMap.get('p-low')).toHaveLength(1)
  })

  describe('filterActive — status 제외', () => {
    it('DEFAULT_FILTER → false', () => {
      const { result } = renderHook(() => useTodoKanban([]))
      expect(result.current.filterActive).toBe(false)
    })
    it("status='할일'만 → false (useTodoList와 다름)", () => {
      const { result } = renderHook(() =>
        useTodoKanban([], 0, { ...DEFAULT_FILTER, status: '할일' })
      )
      expect(result.current.filterActive).toBe(false)
    })
    it("priority='high' → true", () => {
      const { result } = renderHook(() =>
        useTodoKanban([], 0, { ...DEFAULT_FILTER, priority: 'high' })
      )
      expect(result.current.filterActive).toBe(true)
    })
    it('dueDateFrom 설정 → true', () => {
      const { result } = renderHook(() =>
        useTodoKanban([], 0, { ...DEFAULT_FILTER, dueDateFrom: new Date() })
      )
      expect(result.current.filterActive).toBe(true)
    })
  })

  it('setActiveColumn → activeColumn 변경', () => {
    const { result } = renderHook(() => useTodoKanban([]))
    act(() => {
      result.current.setActiveColumn(2)
    })
    expect(result.current.activeColumn).toBe(2)
  })

  it('dueDate=null 투두는 날짜 필터에서 제외', () => {
    const todos = [makeTodoItem({ id: 'no-due', dueDate: null, status: '할일' })]
    const { result } = renderHook(() =>
      useTodoKanban(todos, 0, { ...DEFAULT_FILTER, dueDateFrom: new Date('2026-01-01') })
    )
    expect(result.current.columnMap.get('할일')).toHaveLength(0)
  })
})
```

---

## 8. [F] useCompletedTodoList hook 테스트

**파일**: `src/renderer/src/features/todo/todo-list/model/__tests__/use-completed-todo-list.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { TodoItem } from '@entities/todo'
import { useCompletedTodoList } from '../use-completed-todo-list'
import { DEFAULT_FILTER } from '../../../filter-todo/model/todo-filter'

const BASE_TODO: TodoItem = {
  id: 'todo-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Test',
  description: '',
  status: '할일',
  priority: 'medium',
  isDone: false,
  listOrder: 0,
  kanbanOrder: 0,
  subOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  doneAt: null,
  dueDate: null
}

function makeTodoItem(overrides?: Partial<TodoItem>): TodoItem {
  return { ...BASE_TODO, ...overrides }
}

// filter는 파라미터 — 내부 state 없으므로 rerender 사용
describe('useCompletedTodoList', () => {
  it('parentId≠null 항목 방어 처리 — filteredCompleted에서 제외', () => {
    const todos = [
      makeTodoItem({ id: 'top', parentId: null, isDone: true }),
      makeTodoItem({ id: 'sub', parentId: 'top', isDone: true })
    ]
    const { result } = renderHook(() => useCompletedTodoList(todos, DEFAULT_FILTER))
    expect(result.current.filteredCompleted.map((t) => t.id)).toEqual(['top'])
  })

  it('doneAt DESC 정렬 — 최근 완료가 앞', () => {
    const todos = [
      makeTodoItem({ id: 'old', doneAt: new Date('2026-01-01'), isDone: true }),
      makeTodoItem({ id: 'new', doneAt: new Date('2026-01-31'), isDone: true })
    ]
    const { result } = renderHook(() => useCompletedTodoList(todos, DEFAULT_FILTER))
    expect(result.current.filteredCompleted[0].id).toBe('new')
    expect(result.current.filteredCompleted[1].id).toBe('old')
  })

  it('doneAt=null 항목 → 맨 뒤 (0으로 처리)', () => {
    const todos = [
      makeTodoItem({ id: 'with-date', doneAt: new Date('2026-01-15'), isDone: true }),
      makeTodoItem({ id: 'no-date', doneAt: null, isDone: true })
    ]
    const { result } = renderHook(() => useCompletedTodoList(todos, DEFAULT_FILTER))
    expect(result.current.filteredCompleted[1].id).toBe('no-date')
  })

  describe('filterActive — status 항상 all로 치환', () => {
    it('DEFAULT_FILTER → false', () => {
      const { result } = renderHook(() => useCompletedTodoList([], DEFAULT_FILTER))
      expect(result.current.filterActive).toBe(false)
    })
    it("status='완료'만 설정 → false (status가 'all'로 치환)", () => {
      const { result } = renderHook(() =>
        useCompletedTodoList([], { ...DEFAULT_FILTER, status: '완료' })
      )
      expect(result.current.filterActive).toBe(false)
    })
    it("priority='high' → true", () => {
      const { result } = renderHook(() =>
        useCompletedTodoList([], { ...DEFAULT_FILTER, priority: 'high' })
      )
      expect(result.current.filterActive).toBe(true)
    })
  })

  it('filter 변경 시 rerender로 재계산 확인', () => {
    const todos = [
      makeTodoItem({ id: 'high', priority: 'high', isDone: true }),
      makeTodoItem({ id: 'low', priority: 'low', isDone: true })
    ]
    const { result, rerender } = renderHook(({ filter }) => useCompletedTodoList(todos, filter), {
      initialProps: { filter: DEFAULT_FILTER }
    })
    expect(result.current.filteredCompleted).toHaveLength(2)
    rerender({ filter: { ...DEFAULT_FILTER, priority: 'high' } })
    expect(result.current.filteredCompleted).toHaveLength(1)
    expect(result.current.filteredCompleted[0].id).toBe('high')
  })
})
```

---

## 9. [G] entities/todo React Query hooks 테스트

**파일**: `src/renderer/src/entities/todo/model/__tests__/queries.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useTodosByWorkspace,
  useActiveTodosByWorkspace,
  useCompletedTodosByWorkspace,
  useCreateTodo,
  useUpdateTodo,
  useRemoveTodo,
  useReorderTodoList,
  useReorderTodoKanban,
  useReorderTodoSub
} from '../queries'

const mockFindByWorkspace = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockRemove = vi.fn()
const mockReorderList = vi.fn()
const mockReorderKanban = vi.fn()
const mockReorderSub = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    todo: {
      findByWorkspace: mockFindByWorkspace,
      create: mockCreate,
      update: mockUpdate,
      remove: mockRemove,
      reorderList: mockReorderList,
      reorderKanban: mockReorderKanban,
      reorderSub: mockReorderSub
    }
  }
  vi.clearAllMocks()
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const MOCK_TODO = { id: 't1', title: 'Test', status: '할일' }
```

### 9-1. `useTodosByWorkspace`

```typescript
describe('useTodosByWorkspace', () => {
  it('성공 → data 배열 반환', async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: [MOCK_TODO] })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('success:false → isError=true', async () => {
    mockFindByWorkspace.mockResolvedValue({ success: false, message: '오류' })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it("workspaceId='' → queryFn 미호출 (enabled=false)", () => {
    const { wrapper } = createWrapper()
    renderHook(() => useTodosByWorkspace(''), { wrapper })
    expect(mockFindByWorkspace).not.toHaveBeenCalled()
  })

  it('workspaceId=null → enabled=false', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useTodosByWorkspace(null), { wrapper })
    expect(mockFindByWorkspace).not.toHaveBeenCalled()
  })

  it('workspaceId=undefined → enabled=false', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useTodosByWorkspace(undefined), { wrapper })
    expect(mockFindByWorkspace).not.toHaveBeenCalled()
  })

  it('res.data=null → [] 반환', async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: null })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it("filter='active' → queryKey에 'active' 포함 (4개 요소)", async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: [] })
    const { queryClient, wrapper } = createWrapper()
    renderHook(() => useActiveTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(mockFindByWorkspace).toHaveBeenCalled())
    const cache = queryClient.getQueryCache().getAll()
    const keys = cache.map((q) => q.queryKey)
    expect(keys).toContainEqual(['todo', 'workspace', 'ws-1', 'active'])
  })
})

describe('useActiveTodosByWorkspace', () => {
  it("IPC에 { filter: 'active' } 전달", async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: [] })
    const { wrapper } = createWrapper()
    renderHook(() => useActiveTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(mockFindByWorkspace).toHaveBeenCalled())
    expect(mockFindByWorkspace).toHaveBeenCalledWith('ws-1', { filter: 'active' })
  })
})

describe('useCompletedTodosByWorkspace', () => {
  it("queryKey에 'completed' 포함", async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: [] })
    const { queryClient, wrapper } = createWrapper()
    renderHook(() => useCompletedTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(mockFindByWorkspace).toHaveBeenCalled())
    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
    expect(keys).toContainEqual(['todo', 'workspace', 'ws-1', 'completed'])
  })
})
```

### 9-2. 뮤테이션 hooks

```typescript
describe('useCreateTodo', () => {
  it('create(workspaceId, data) 호출', async () => {
    mockCreate.mockResolvedValue({ success: true, data: MOCK_TODO })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateTodo(), { wrapper })
    result.current.mutate({ workspaceId: 'ws-1', data: { title: '새 투두' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockCreate).toHaveBeenCalledWith('ws-1', { title: '새 투두' })
  })
})

describe('useUpdateTodo', () => {
  it('update(todoId, data) 호출 — workspaceId IPC 미포함', async () => {
    mockUpdate.mockResolvedValue({ success: true, data: MOCK_TODO })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateTodo(), { wrapper })
    result.current.mutate({ workspaceId: 'ws-1', todoId: 'todo-1', data: { title: '수정' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockUpdate).toHaveBeenCalledWith('todo-1', { title: '수정' })
    // workspaceId는 IPC에 전달 안 됨 — 2개 인자만
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate.mock.calls[0]).toHaveLength(2)
  })
})

describe('useRemoveTodo', () => {
  it('remove(todoId) 호출 — workspaceId IPC 미포함', async () => {
    mockRemove.mockResolvedValue({ success: true, data: undefined })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useRemoveTodo(), { wrapper })
    result.current.mutate({ workspaceId: 'ws-1', todoId: 'todo-1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockRemove).toHaveBeenCalledWith('todo-1')
    expect(mockRemove.mock.calls[0]).toHaveLength(1)
  })
})

describe('useReorderTodoSub', () => {
  it('reorderSub(parentId, updates) 호출', async () => {
    mockReorderSub.mockResolvedValue({ success: true, data: undefined })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReorderTodoSub(), { wrapper })
    result.current.mutate({
      workspaceId: 'ws-1',
      parentId: 'par-1',
      updates: [{ id: 'sub-1', order: 0 }]
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockReorderSub).toHaveBeenCalledWith('par-1', [{ id: 'sub-1', order: 0 }])
  })
})
```

---

## 10. 구현 순서

```
1. [A] todoRepository — testDb 기반, setup.ts 수정 불필요
2. [B] todoService — repository 전체 mock, MOCK_TODO_ROW 완전한 필드 필수
3. [C] todo-filter — 순수 함수, 빠른 단위 테스트
4. [D] useTodoList — renderHook + act
5. [E] useTodoKanban — renderHook + act
6. [F] useCompletedTodoList — renderHook + rerender (act 아님)
7. [G] queries — QueryClientProvider + waitFor
```

---

## 11. 완료 기준

| 명령                | 범위            | 통과 조건                |
| ------------------- | --------------- | ------------------------ |
| `npm run test`      | [A][B]          | repository + service     |
| `npm run test:web`  | [C][D][E][F][G] | filter + hooks + queries |
| `npm run typecheck` | 전체            | 타입 오류 없음           |

**목표 케이스 수: 70건 이상**

| 섹션             | 목표  |
| ---------------- | ----- |
| [A] Repository   | ~20건 |
| [B] Service      | ~28건 |
| [C] 순수 함수    | ~15건 |
| [D]+[E]+[F] Hook | ~17건 |
| [G] Queries      | ~15건 |
