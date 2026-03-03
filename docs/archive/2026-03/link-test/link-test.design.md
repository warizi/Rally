# link-test Design Document

> **Summary**: entity-link 기능의 테스트 코드 설계 — Repository 통합, Service 단위, Renderer 순수 함수, 기존 todo 테스트 수정
>
> **Project**: Rally
> **Date**: 2026-03-02
> **Status**: Draft
> **Planning Doc**: [link-test.plan.md](../../01-plan/features/link-test.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- entity-link의 모든 분기(normalize 4분기, isSource 양방향, orphan 정리)를 테스트로 커버
- 기존 todo.test.ts의 깨진 mock을 수정하여 전체 테스트 스위트 정상화
- 프로젝트 기존 패턴(in-memory SQLite 통합 / vi.mock 단위)을 일관되게 적용

### 1.2 Design Principles

- **기존 패턴 준수**: setup.ts(testDb) + factory mock 패턴을 그대로 따름
- **분기 완전 커버**: 코드의 모든 if/switch branch에 대응하는 테스트 존재
- **독립성**: 각 테스트는 beforeEach에서 상태 초기화, 실행 순서 무관

---

## 2. Architecture

### 2.1 테스트 레이어 구조

```
┌────────────────────────────────────────────────────────────────────┐
│ vitest.config.web.mts (happy-dom)                                  │
│  └─ [C] toTabOptions.test.ts — 순수 함수 테스트                      │
├────────────────────────────────────────────────────────────────────┤
│ vitest.config.node.mts (node)                                      │
│  ├─ [B] entity-link.test.ts (service) — vi.mock 단위 테스트          │
│  ├─ [A] entity-link.test.ts (repository) — testDb 통합 테스트        │
│  ├─ [D] todo.test.ts (service) — 기존 수정 (mock 보강)              │
│  └─ [D-2] todo.test.ts (repository) — findAllDescendantIds 통합    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 의존성 관계

| 테스트 파일                     | 의존 대상                                    | Mock 전략              |
| ------------------------------- | -------------------------------------------- | ---------------------- |
| [A] repository/entity-link.test | testDb (in-memory SQLite)                    | 없음 (실제 DB)         |
| [B] service/entity-link.test    | entityLinkRepository + 5개 entity repository | 전체 vi.mock (factory) |
| [C] toTabOptions.test           | 없음 (순수 함수)                             | 없음                   |
| [D] service/todo.test           | todoRepository + entityLinkService           | 기존 factory mock 보강 |
| [D-2] repository/todo.test      | testDb (in-memory SQLite)                    | 없음 (실제 DB)         |

---

## 3. 파일별 상세 설계

---

### 3.1 [D] todo.test.ts 수정

**파일**: `src/main/services/__tests__/todo.test.ts`

#### 3.1.1 Mock 수정

**현재 문제**: `todoService.remove()`가 `findAllDescendantIds` + `entityLinkService.removeAllLinksForTodos`를 호출하나, mock factory에 누락됨.

```typescript
// ─── 수정 1: todoRepository mock에 findAllDescendantIds 추가 ───
vi.mock('../../repositories/todo', () => ({
  todoRepository: {
    findByWorkspaceId: vi.fn(),
    findById: vi.fn(),
    findByParentId: vi.fn(),
    findTopLevelByWorkspaceId: vi.fn(),
    findAllDescendantIds: vi.fn(), // ← 추가
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkUpdateListOrder: vi.fn(),
    bulkUpdateKanbanOrder: vi.fn(),
    bulkUpdateSubOrder: vi.fn()
  }
}))

// ─── 수정 2: entityLinkService mock 추가 ───
vi.mock('../entity-link', () => ({
  entityLinkService: {
    removeAllLinksForTodos: vi.fn()
  }
}))
```

#### 3.1.2 import 및 beforeEach 보강

```typescript
// ─── 파일 상단 import 섹션에 추가 ───
import { entityLinkService } from '../entity-link'

// ─── beforeEach 내부에 추가 ───
beforeEach(() => {
  vi.clearAllMocks()
  // ... 기존 mock 설정 ...
  vi.mocked(todoRepository.findAllDescendantIds).mockReturnValue([]) // ← 추가
})
```

> **주의**: `entityLinkService`는 `vi.mock('../entity-link', ...)`으로 자동 mock되므로
> import만 하면 mock된 버전이 주입된다. `beforeEach`에서 별도 설정 불필요.

#### 3.1.3 remove describe 보강

```typescript
describe('remove', () => {
  // 기존 2건 유지 (mock 수정으로 통과)
  it('정상 삭제 → todoRepository.delete 1회', () => {
    todoService.remove('todo-1')
    expect(todoRepository.delete).toHaveBeenCalledWith('todo-1')
    expect(todoRepository.delete).toHaveBeenCalledTimes(1)
  })

  it('없는 todoId → NotFoundError', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() => todoService.remove('ghost')).toThrow(NotFoundError)
  })

  // 추가 3건
  it('삭제 시 findAllDescendantIds(todoId) 호출', () => {
    todoService.remove('todo-1')
    expect(todoRepository.findAllDescendantIds).toHaveBeenCalledWith('todo-1')
  })

  it('삭제 시 entityLinkService.removeAllLinksForTodos 호출', () => {
    todoService.remove('todo-1')
    expect(entityLinkService.removeAllLinksForTodos).toHaveBeenCalledWith(['todo-1'])
  })

  it('subtodo 있을 때 → 본인+subtodo ID 모두 전달', () => {
    vi.mocked(todoRepository.findAllDescendantIds).mockReturnValue(['sub-1', 'sub-2'])
    todoService.remove('todo-1')
    expect(entityLinkService.removeAllLinksForTodos).toHaveBeenCalledWith([
      'todo-1',
      'sub-1',
      'sub-2'
    ])
  })
})
```

---

### 3.2 [D-2] findAllDescendantIds BFS 통합 테스트

**파일**: `src/main/repositories/__tests__/todo.test.ts` (신규)

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { todoRepository } from '../todo'

const WS_ID = 'ws-test'

function makeTodo(id: string, parentId: string | null = null) {
  return {
    id,
    workspaceId: WS_ID,
    parentId,
    title: id,
    description: '',
    status: '할일' as const,
    priority: 'medium' as const,
    isDone: false,
    listOrder: 0,
    kanbanOrder: 0,
    subOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    doneAt: null,
    dueDate: null,
    startDate: null
  }
}

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

describe('findAllDescendantIds', () => {
  it('자식 없는 todo → 빈 배열', () => {
    testDb.insert(schema.todos).values(makeTodo('leaf')).run()
    expect(todoRepository.findAllDescendantIds('leaf')).toEqual([])
  })

  it('1단계 자식 → 자식 ID 배열', () => {
    testDb.insert(schema.todos).values(makeTodo('parent')).run()
    testDb.insert(schema.todos).values(makeTodo('child-1', 'parent')).run()
    testDb.insert(schema.todos).values(makeTodo('child-2', 'parent')).run()
    const result = todoRepository.findAllDescendantIds('parent')
    expect(result).toHaveLength(2)
    expect(result).toContain('child-1')
    expect(result).toContain('child-2')
  })

  it('다단계 (parent→child→grandchild) → 모든 하위 ID', () => {
    testDb.insert(schema.todos).values(makeTodo('p')).run()
    testDb.insert(schema.todos).values(makeTodo('c', 'p')).run()
    testDb.insert(schema.todos).values(makeTodo('gc', 'c')).run()
    const result = todoRepository.findAllDescendantIds('p')
    expect(result).toHaveLength(2)
    expect(result).toContain('c')
    expect(result).toContain('gc')
  })

  it('존재하지 않는 parentId → 빈 배열', () => {
    expect(todoRepository.findAllDescendantIds('non-exist')).toEqual([])
  })
})
```

---

### 3.3 [A] entityLinkRepository 통합 테스트

**파일**: `src/main/repositories/__tests__/entity-link.test.ts`

#### 3.3.1 공통 설정

```typescript
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
```

#### 3.3.2 link

```typescript
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
```

#### 3.3.3 unlink

```typescript
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
```

#### 3.3.4 findByEntity

```typescript
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
```

#### 3.3.5 removeAllByEntity

```typescript
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
```

#### 3.3.6 removeAllByEntities

```typescript
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
```

---

### 3.4 [B] entityLinkService 단위 테스트

**파일**: `src/main/services/__tests__/entity-link.test.ts`

#### 3.4.1 공통 설정

```typescript
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

function mockFindById(type: LinkableEntityType, returnValue: unknown = MOCK_ENTITY) {
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
// mockReturnValue는 영구 설정이므로 findEntity가 2회 호출되어도 같은 값 반환 → 정상 동작.
function mockBothEntities(typeA: LinkableEntityType, typeB: LinkableEntityType) {
  mockFindById(typeA)
  if (typeA !== typeB) mockFindById(typeB)
}

beforeEach(() => {
  vi.clearAllMocks()
})
```

#### 3.4.2 link

```typescript
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

  it('EC-02: typeA 엔티티 미존재 → NotFoundError', () => {
    mockFindById('todo', undefined)
    expect(() => entityLinkService.link('todo', 't1', 'note', 'n1', 'ws-1')).toThrow(NotFoundError)
  })

  it('EC-02: typeB 엔티티 미존재 → NotFoundError', () => {
    mockFindById('todo')
    mockFindById('note', undefined)
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
```

#### 3.4.3 unlink

```typescript
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
```

#### 3.4.4 getLinked

```typescript
describe('getLinked', () => {
  const makeRow = (overrides?: Record<string, unknown>) => ({
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

  it('EC-09: 삭제된 엔티티 → 필터링 + orphan unlink', () => {
    vi.mocked(entityLinkRepository.findByEntity).mockReturnValue([makeRow()] as any)
    mockFindById('todo', undefined)
    const result = entityLinkService.getLinked('note', 'n1')
    expect(result).toHaveLength(0)
    expect(entityLinkRepository.unlink).toHaveBeenCalledWith('note', 'n1', 'todo', 't1')
  })

  it('혼합: 유효 2건 + 고아 1건 → result 2건 + unlink 1회', () => {
    // 3개 row 모두 targetType='todo'이므로 findEntity가 todoRepository.findById만 호출.
    // mockReturnValueOnce 체이닝은 호출 순서에 의존 — row 타입을 변경하면 깨질 수 있음.
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
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    const result = entityLinkService.getLinked('note', 'n1')
    expect(result).toEqual([])
    expect(entityLinkRepository.unlink).toHaveBeenCalledTimes(2)
  })
})
```

#### 3.4.5 removeAllLinks / removeAllLinksForTodos

```typescript
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
```

---

### 3.5 [C] toTabOptions 순수 함수 테스트

**파일**: `src/renderer/src/features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts`

> **참고**: Web 테스트는 `vitest.config.web.mts`에서 `globals: true`이므로
> `describe`, `expect`, `it` 등의 import가 불필요하다. (프로젝트 패턴: global import 생략)

```typescript
import { toTabOptions } from '../to-tab-options'

describe('toTabOptions', () => {
  it("todo → type='todo-detail', pathname='/todo/{id}', title=전달값", () => {
    expect(toTabOptions('todo', 'td-1', '내 할일')).toEqual({
      type: 'todo-detail',
      pathname: '/todo/td-1',
      title: '내 할일'
    })
  })

  it("note → type='note', pathname='/folder/note/{id}', title=전달값", () => {
    expect(toTabOptions('note', 'n-1', '메모')).toEqual({
      type: 'note',
      pathname: '/folder/note/n-1',
      title: '메모'
    })
  })

  it("pdf → type='pdf', pathname='/folder/pdf/{id}', title=전달값", () => {
    expect(toTabOptions('pdf', 'p-1', '문서.pdf')).toEqual({
      type: 'pdf',
      pathname: '/folder/pdf/p-1',
      title: '문서.pdf'
    })
  })

  it("csv → type='csv', pathname='/folder/csv/{id}', title=전달값", () => {
    expect(toTabOptions('csv', 'c-1', '데이터.csv')).toEqual({
      type: 'csv',
      pathname: '/folder/csv/c-1',
      title: '데이터.csv'
    })
  })

  it("schedule → type='calendar', pathname='/calendar', 전달 title 무시 → 고정 '캘린더'", () => {
    const result = toTabOptions('schedule', 's-1', '내 일정')
    expect(result).toEqual({
      type: 'calendar',
      pathname: '/calendar',
      title: '캘린더'
    })
  })
})
```

---

## 4. 구현 순서

| 순서 | 파일                                                                                     | 작업                                 | 의존 |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------------------ | ---- |
| 1    | `src/main/services/__tests__/todo.test.ts`                                               | mock 보강 + remove 테스트 추가       | —    |
| 2    | `src/main/repositories/__tests__/todo.test.ts`                                           | findAllDescendantIds BFS 통합 테스트 | —    |
| 3    | `src/main/repositories/__tests__/entity-link.test.ts`                                    | Repository 통합 테스트               | —    |
| 4    | `src/main/services/__tests__/entity-link.test.ts`                                        | Service 단위 테스트                  | —    |
| 5    | `src/renderer/src/features/entity-link/manage-link/lib/__tests__/to-tab-options.test.ts` | Renderer 순수 함수 테스트            | —    |
| 6    | `npm run test && npm run test:web`                                                       | 전체 통과 확인                       | 1-5  |

---

## 5. 분기 커버리지 매핑

### 5.1 normalize() — 4 branches

| Branch | 조건                        | 테스트                       |
| ------ | --------------------------- | ---------------------------- |
| 1      | typeA < typeB               | B-1-2 (note < todo)          |
| 2      | typeA > typeB               | B-2-1 (todo > note → 정규화) |
| 3      | typeA === typeB, idA < idB  | B-1-3                        |
| 4      | typeA === typeB, idA >= idB | B-1-3-R                      |

### 5.2 link() — 실행 경로

| Line   | 분기                                   | 테스트        |
| ------ | -------------------------------------- | ------------- |
| L72-74 | self-link (typeA===typeB && idA===idB) | B-1-4 (EC-01) |
| L76-77 | entityA not found                      | B-1-5 (EC-02) |
| L78-79 | entityB not found                      | B-1-6 (EC-02) |
| L81    | getWorkspaceId(typeA) null             | B-1-10        |
| L82    | getWorkspaceId(typeB) null             | B-1-11        |
| L83-85 | wsA !== wsB                            | B-1-7 (EC-03) |
| L86-88 | wsA !== workspaceId                    | B-1-8 (EC-03) |
| L90-95 | happy path                             | B-1-1, B-1-9  |

### 5.3 getLinked() — isSource 분기

| 조건                                  | 테스트 |
| ------------------------------------- | ------ |
| 다른 타입, isSource=true              | B-3-1  |
| 다른 타입, isSource=false             | B-3-2  |
| 같은 타입 (todo↔todo), isSource=true  | B-3-8  |
| 같은 타입 (todo↔todo), isSource=false | B-3-9  |
| orphan (entity not found)             | B-3-4  |
| mixed (valid + orphan)                | B-3-5  |
| all orphans                           | B-3-10 |

---

## 6. 성공 기준

- `npm run test` — 전체 node 테스트 통과 (기존 todo 포함)
- `npm run test:web` — toTabOptions 테스트 통과
- normalize 4 branches 100% 커버
- getLinked isSource 양방향 (같은 타입 포함) 커버
- orphan cleanup 3 시나리오 (단일, 혼합, 전부) 커버

---

## Version History

| Version | Date       | Changes                                                        |
| ------- | ---------- | -------------------------------------------------------------- |
| 0.1     | 2026-03-02 | Initial draft                                                  |
| 0.2     | 2026-03-02 | 점검 반영: import 명시, globals:true 적용, mock 순서 주석 보강 |
