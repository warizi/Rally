# Plan: Todo 테스트 코드 작성

> 작성일: 2026-02-28
> 기능: todo-test
> 레벨: Dynamic

---

## 1. 배경 및 목적

Todo 기능은 이미 구현 완료되어 있으나 테스트 코드가 없는 상태이다.
기존 코드베이스의 테스트 패턴(repository/service/queries)을 따라 신뢰성을 확보한다.

---

## 2. 테스트 파일 목록

### 2-1. Main Process — `vitest.config.node.mts` (`npm run test`)

| 파일 | 비고 |
|------|------|
| `src/main/repositories/__tests__/todo.test.ts` | testDb (in-memory SQLite) 사용 |
| `src/main/services/__tests__/todo.test.ts` | repository 전체 vi.mock |

> ⚠️ Node 환경은 `globals: false` → `describe`, `it`, `expect`, `vi`, `beforeEach` 모두 명시적 import

### 2-2. Renderer — `vitest.config.web.mts` (`npm run test:web`)

| 파일 | 비고 |
|------|------|
| `src/renderer/src/features/todo/filter-todo/model/__tests__/todo-filter.test.ts` | 순수 함수, async 없음 |
| `src/renderer/src/features/todo/todo-list/model/__tests__/use-todo-list.test.ts` | renderHook + act |
| `src/renderer/src/features/todo/todo-kanban/model/__tests__/use-todo-kanban.test.ts` | renderHook + act |
| `src/renderer/src/features/todo/todo-list/model/__tests__/use-completed-todo-list.test.ts` | renderHook + rerender |
| `src/renderer/src/entities/todo/model/__tests__/queries.test.ts` | renderHook + QueryClientProvider + waitFor |

---

## 3. 환경 설정

### `src/main/__tests__/setup.ts` — **수정 불필요**

`todos.workspaceId → workspaces.id (onDelete: cascade)` 이므로 workspaces 삭제 시
todos가 자동 cascade 삭제된다. 기존 `notes`도 동일 방식으로 동작 중.

> ⚠️ `testDb.delete(schema.todos).run()` 직접 추가 금지:
> `todos.parentId → todos.id` (self-referential FK) 로 인해 전체 삭제 시
> constraint violation 가능성 있음.

---

## 4. 테스트 케이스 상세

---

### [A] todoRepository

**픽스처 헬퍼 패턴**:
```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { todoRepository, type TodoInsert } from '../todo'

const WS_ID = 'ws-1'

beforeEach(() => {
  testDb.insert(schema.workspaces).values({
    id: WS_ID, name: 'Test', path: '/test', createdAt: new Date(), updatedAt: new Date()
  }).run()
})

function makeTodo(overrides?: Partial<TodoInsert>): TodoInsert {
  return {
    id: 'todo-1', workspaceId: WS_ID, parentId: null,
    title: 'Test Todo', description: '', status: '할일', priority: 'medium',
    isDone: false, listOrder: 0, kanbanOrder: 0, subOrder: 0,
    createdAt: new Date(), updatedAt: new Date(), doneAt: null, dueDate: null,
    ...overrides
  }
}
```

#### `findByWorkspaceId`

| # | 케이스 | 기대값 |
|---|--------|--------|
| 1 | filter 없음(=all), 투두 없음 | `[]` |
| 2 | filter 없음, 최상위+서브 혼재 | 전체 반환 |
| 3 | filter='active' — 최상위 미완료 (isDone=false, parentId=null) | **포함** |
| 4 | filter='active' — 최상위 완료 (isDone=true, parentId=null) | **제외** |
| 5 | filter='active' — 서브투두 미완료 (isDone=false, parentId≠null) | **포함** |
| 6 | filter='active' — 서브투두 완료 (isDone=true, parentId≠null) | **포함** ← 핵심 |
| 7 | filter='completed' — 최상위 완료 | 포함 |
| 8 | filter='completed' — 서브투두 완료 (parentId≠null) | **제외** |

#### `findById`
- 존재하는 id → Todo 반환
- 없는 id → `undefined`

#### `findByParentId`
- 해당 parentId를 가진 서브투두만 반환 (다른 parentId 배제 확인)

#### `findTopLevelByWorkspaceId`
- `parentId=null`인 항목만 반환 (서브투두 배제 확인)

#### `create`
- 모든 필드 반환값 검증 (id, title, status, isDone, listOrder 등)
- `listOrder`, `kanbanOrder`, `subOrder`는 `real` 타입 (소수 허용)

#### `update`
- 지정 필드만 변경, 나머지 보존
- 없는 id → `undefined` 반환

#### `delete`
- 삭제 후 `findById` → undefined
- 부모 삭제 시 서브투두 cascade 삭제 (자식도 없어짐)

#### `bulkUpdateListOrder`
- 빈 배열 → no-op (조기 return, DB 변화 없음)
- 여러 항목 listOrder 변경 → `updated_at`도 갱신

#### `bulkUpdateKanbanOrder` — status 포함

raw SQL: `UPDATE todos SET kanban_order=?, status=?, is_done=?, done_at=?, updated_at=? WHERE id=?`

- `status='완료'` → `isDone=1`, `doneAt=<number 타입 timestamp>`
- `status='할일'` → `isDone=0`, `doneAt=null`
- kanbanOrder 정상 변경

> `doneAt`은 SQLite에 integer(timestamp_ms)로 저장. Drizzle ORM이 Date로 읽어오는지 확인.

#### `bulkUpdateKanbanOrder` — status 미포함

raw SQL: `UPDATE todos SET kanban_order=?, updated_at=? WHERE id=?`

- kanbanOrder + updatedAt만 변경 (isDone, doneAt 불변)
- 빈 배열 → no-op

#### `bulkUpdateSubOrder`
- 빈 배열 → no-op
- 여러 항목 subOrder 변경 → `updated_at` 갱신

---

### [B] todoService

**Mock 선언** (파일: `src/main/services/__tests__/todo.test.ts`):
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
```

**Mock 반환값 주의**:

`todoService`는 내부적으로 `toTodoItem(todo)`를 호출하므로,
`todoRepository.create`/`todoRepository.update`/`todoRepository.findByWorkspaceId`/`todoRepository.findById`
mock의 반환값은 **완전한 `Todo` 객체** 여야 한다.

```typescript
// 완전한 Todo mock 객체 — toTodoItem이 정상 동작하려면 모든 필드 필요
const MOCK_TODO_ROW = {
  id: 'todo-1', workspaceId: 'ws-1', parentId: null,
  title: 'Test', description: '', status: '할일', priority: 'medium',
  isDone: false, listOrder: 0, kanbanOrder: 0, subOrder: 0,
  createdAt: new Date(), updatedAt: new Date(), doneAt: null, dueDate: null
}
```

**기본 beforeEach**:
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue({
    id: 'ws-1', name: 'Test', path: '/test', createdAt: new Date(), updatedAt: new Date()
  })
})
```

#### `findByWorkspace`
- 정상: `todoRepository.findByWorkspaceId` 호출 → 결과 반환
- 워크스페이스 없음 → `NotFoundError`

#### `create`

| # | 케이스 | 검증 포인트 |
|---|--------|-------------|
| 1 | 최상위 생성 (parentId 없음/null) | `findTopLevelByWorkspaceId` 호출, `findById` **미호출** |
| 2 | 서브투두 생성 (parentId 있음) | `findByParentId(parentId)` 호출, `findTopLevelByWorkspaceId` **미호출** |
| 3 | 형제 없을 때 | listOrder=kanbanOrder=subOrder=0 으로 create 호출됨 |
| 4 | 형제 있을 때 (max listOrder=2) | listOrder=3 으로 create 호출됨 (kanbanOrder, subOrder도 동일 로직) |
| 5 | `status='완료'`로 생성 | `isDone=true`, `doneAt: expect.any(Date)` 으로 create 호출됨 |
| 6 | 기본 status('할일') 생성 | `isDone=false`, `doneAt=null` 으로 create 호출됨 |
| 7 | `title='  제목  '` 전달 | `todoRepository.create` 에 `title: '제목'` (trim 적용) |
| 8 | `description` 미전달 | `todoRepository.create` 에 `description: ''` 전달 |
| 9 | 없는 parentId | `NotFoundError` |
| 10 | 없는 workspaceId | `NotFoundError` |

> `if (data.parentId)` 분기: `null`/`undefined` 이면 `todoRepository.findById` 미호출
> `create`에서 `doneAt`은 `new Date()` (`Date` 객체) — `reorderKanban`의 `number`와 다름

#### `update` — `resolveDoneFields` 핵심 로직

`resolveDoneFields` 우선순위:
- `data.isDone` 정의 → isDone 우선, status는 반드시 '완료' 또는 '할일' 중 하나
- `data.isDone` 미정의 + `data.status` 정의 → status 기반 계산

| # | 입력 | repository.update 인자 기대값 |
|---|------|-------------------------------|
| 1 | `{ isDone: true }` | `isDone: true, status: '완료', doneAt: expect.any(Date)` |
| 2 | `{ isDone: false }` | `isDone: false, status: '할일', doneAt: null` |
| 3 | `{ status: '완료' }` | `isDone: true, status: '완료', doneAt: expect.any(Date)` |
| 4 | `{ status: '진행중' }` | `isDone: false, status: '진행중', doneAt: null` |
| 5 | `{ status: '보류' }` | `isDone: false, status: '보류', doneAt: null` |
| 6 | `{ title: '제목만' }` | isDone/status/doneAt 필드 미포함 |
| 7 | `{ isDone: false, status: '진행중' }` | `isDone: false, status: '할일'` ← **isDone 우선**, status 무시 |
| 8 | `{ title: '  수정  ' }` | `todoRepository.update` 에 `title: '수정'` (trim 적용) |
| 9 | `{ description: '  설명  ' }` | `todoRepository.update` 에 `description: '설명'` (trim 적용) |
| 10 | 없는 todoId | `NotFoundError` (findById 단계) |
| 11 | update 반환 undefined | `NotFoundError` (update 단계) |

**부모 자동완료** — 트리거: `doneFields.isDone === true && todo.parentId`

| # | 케이스 | repository.update 호출 횟수 |
|---|--------|----------------------------|
| A | `{ isDone: true }` + 서브투두 + 모든 형제 완료 | 2회 (본인 + 부모) |
| B | `{ isDone: true }` + 서브투두 + 미완료 형제 있음 | 1회 (본인만) |
| C | `{ isDone: true }` + 서브투두 **단독** (형제 없음) | 2회 ← `s.id===todoId ? true : s.isDone`에서 allDone=true |
| D | `{ isDone: true }` + 최상위 (parentId=null) | 1회, `findByParentId` **미호출** |
| E | `{ status: '완료' }` + 서브투두 + 모든 형제 완료 | 2회 ← status='완료'도 `doneFields.isDone=true` 트리거 |

#### `remove`
- 정상 삭제 → `todoRepository.delete` 1회 호출
- 없는 todoId → `NotFoundError` (`findById` 단계)

#### `reorderList`
- 정상: workspace 확인 후 `bulkUpdateListOrder` 호출
- 없는 workspaceId → `NotFoundError`

#### `reorderKanban`

| 케이스 | bulkUpdateKanbanOrder 인자 |
|--------|---------------------------|
| `status='완료'` 포함 update | `{ id, order, status:'완료', isDone: true, doneAt: <number> }` |
| `status='할일'` 포함 update | `{ id, order, status:'할일', isDone: false, doneAt: null }` |
| status 미포함 update | `{ id, order }` 만 전달 |

> `doneAt`은 `Date`가 아닌 `number` (= `Date.now()` 반환값) 타입

- 없는 workspaceId → `NotFoundError`

#### `reorderSub`
- 정상: parent 확인 후 `bulkUpdateSubOrder` 호출
- 없는 parentId → `NotFoundError`

#### Date 변환 검증 (toTodoItem)
- create/update 반환 TodoItem의 `createdAt`, `updatedAt` → `Date` 인스턴스
- `isDone=true` 시 `doneAt` → `Date` 인스턴스
- `isDone=false` 시 `doneAt` → `null`

---

### [C] todo-filter 순수 함수

#### `isFilterActive`

| 입력 | 기대값 |
|------|--------|
| `DEFAULT_FILTER` | `false` |
| `{ ...DEFAULT, status: '할일' }` | `true` |
| `{ ...DEFAULT, priority: 'high' }` | `true` |
| `{ ...DEFAULT, dueDateFrom: new Date() }` | `true` |
| `{ ...DEFAULT, dueDateTo: new Date() }` | `true` |

#### `filterToParams` / `filterFromParams`

- `filterFromParams(undefined, 'k')` → `DEFAULT_FILTER` 반환
- null 날짜: `dueDateFrom=null` → params에 `''` 저장 → 역직렬화 시 `null` 복원
- 완전한 roundtrip: `filterFromParams(filterToParams(filter, 'k'), 'k')` → `toEqual(filter)`
  (vitest `toEqual`로 Date 객체 비교 가능)

#### `applyFilter`

| # | 케이스 | 포인트 |
|---|--------|--------|
| 1 | DEFAULT_FILTER → 전체 반환 | |
| 2 | `status='할일'` 필터 | 해당 status만 |
| 3 | `priority='high'` 필터 | 해당 priority만 |
| 4 | `dueDateFrom` 설정 + `todo.dueDate` 있음 | from 이후 포함 |
| 5 | `dueDateFrom` 설정 + `todo.dueDate=null` | **제외** (`t.dueDate && ...` 조건) |
| 6 | `dueDateTo` 설정 | 23:59:59.999까지 end-of-day 포함 |
| 7 | `dueDateTo` 설정 + `todo.dueDate=null` | **제외** |
| 8 | status + priority 복합 | AND 적용 |

---

### [D] useTodoList hook

**훅 시그니처**: `useTodoList(allTodos, initialFilter?)`
**내부 state**: `filter` (useState), 계산값은 useMemo
**테스트 도구**: `renderHook` + `act` from `@testing-library/react`

#### topLevel / subTodoMap
- `topLevel`: `parentId===null` 인 항목만
- `subTodoMap`: parentId 기준 Map, **subOrder ASC** 정렬
- **비필터**: `subTodoMap`은 `allTodos` 전체 기반 → 필터로 제외된 부모의 서브투두도 포함
  (예: `priority='high'` 필터 적용 → `filteredTopLevel`에서 제외된 부모라도 `subTodoMap.get(parentId)` 반환됨)

#### 빈 입력 (allTodos=[])
- `useTodoList([], DEFAULT_FILTER)` → `filteredTopLevel=[]`, `subTodoMap.size===0`, `filterActive=false`

#### filteredTopLevel
- filter 미적용 시 topLevel 전체 **listOrder ASC** 정렬
- filter 적용 후 정렬: `listOrder=2, 0, 1` 순서로 입력 → `0, 1, 2` 순 반환

#### filterActive — **`isFilterActive` 전체 사용 (status 포함)**

| 입력 | `filterActive` |
|------|----------------|
| DEFAULT_FILTER | `false` |
| `status='할일'` | **`true`** ← useTodoKanban과 다름 |
| `priority='high'` | `true` |

#### setFilter
- `act(() => result.current.setFilter({ ...DEFAULT, status: '할일' }))` → filteredTopLevel 재계산

---

### [E] useTodoKanban hook

**훅 시그니처**: `useTodoKanban(allTodos, initialActiveColumn?, initialFilter?)`
**내부 state**: `filter` (useState), `activeColumn` (useState)
**테스트 도구**: `renderHook` + `act` from `@testing-library/react`

#### 빈 입력 (allTodos=[])
- `useTodoKanban([])` → `columnMap.get('할일')===[]`, 4개 컬럼 모두 `[]` (undefined 아님)
- `subTodoMap.size === 0`

#### columnMap
- 4개 status 키 항상 존재: `KANBAN_COLUMNS = ['할일', '진행중', '완료', '보류']`
- `columnMap.get('보류')` → `[]` (투두 없어도 `undefined` 아님)
- 각 status별 **kanbanOrder ASC** 정렬 확인

#### subTodoMap
- **kanbanOrder ASC** 정렬 (useTodoList는 subOrder)
- **비필터**: `subTodoMap`은 `allTodos` 전체 기반 → 필터 후 컬럼에서 제외된 부모의 서브투두도 포함

#### filterActive — **status 제외, priority/dueDate만**

| 입력 | `filterActive` |
|------|----------------|
| DEFAULT_FILTER | `false` |
| `status='할일'`만 설정 | **`false`** ← useTodoList와 다름 |
| `priority='high'` | `true` |
| `dueDateFrom` 설정 | `true` |
| `dueDateTo` 설정 | `true` |

#### 필터 케이스 (columnMap 검증)
- `priority='high'` 필터 → 각 컬럼에 해당 priority만 포함
- `dueDate=null` 투두는 날짜 필터에서 제외

#### activeColumn
- `act(() => result.current.setActiveColumn(2))` → `activeColumn === 2`

---

### [F] useCompletedTodoList hook

**훅 시그니처**: `useCompletedTodoList(completedTodos, filter)` — **filter를 파라미터로 받음**
**내부 state 없음** → `filter` 변경 테스트는 `rerender` 사용
**테스트 도구**: `renderHook` with `rerender` option from `@testing-library/react`

```typescript
const { result, rerender } = renderHook(
  ({ todos, filter }) => useCompletedTodoList(todos, filter),
  { initialProps: { todos: completedTodos, filter: DEFAULT_FILTER } }
)
// filter 변경 시:
rerender({ todos: completedTodos, filter: { ...DEFAULT_FILTER, priority: 'high' } })
```

#### parentId 방어 처리
- `completedTodos`에 `parentId≠null` 항목 포함 시 → `filteredCompleted`에서 제외

#### doneAt DESC 정렬
- 더 최근에 완료된 항목이 앞
- `doneAt=null` 항목 → `getTime()` 기준 0 취급 → 맨 뒤

#### filterActive — **status 항상 'all'로 치환**

```typescript
isFilterActive({ ...filter, status: 'all' })
```

| 입력 filter | `filterActive` |
|------------|----------------|
| DEFAULT_FILTER | `false` |
| `status='완료'`만 설정 | **`false`** ← status가 'all'로 치환되므로 |
| `priority='high'`만 설정 | `true` |
| `dueDateFrom` 설정 | `true` |

---

### [G] entities/todo React Query hooks

**IPC mock** (`beforeEach`/`afterEach`):
```typescript
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
```

**QueryClientProvider wrapper** (모든 hook 공용):
```typescript
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
```

#### queryKey 구조

```typescript
// filter 없을 때 (3개 요소)
['todo', 'workspace', workspaceId]

// filter 있을 때 (4개 요소)
['todo', 'workspace', workspaceId, 'active']
['todo', 'workspace', workspaceId, 'completed']
```

#### `useTodosByWorkspace`

| # | 케이스 |
|---|--------|
| 1 | 성공 → data 배열 반환 |
| 2 | `success:false` → `isError=true` |
| 3 | `workspaceId=''` → queryFn 미호출 (enabled=false) |
| 4 | `workspaceId=null` → enabled=false |
| 5 | `workspaceId=undefined` → enabled=false |
| 6 | `res.data=null` **또는 `undefined`** → `[]` 반환 (`?? []`는 양쪽 모두 처리) |
| 7 | `filter='active'` → queryKey 4개 요소 (`[..., 'active']`) |

#### `useActiveTodosByWorkspace`
- queryKey에 `'active'` 포함 (4개 요소 확인)
- IPC에 `{ filter: 'active' }` 전달 확인

#### `useCompletedTodosByWorkspace`
- queryKey에 `'completed'` 포함 (4개 요소 확인)

#### 뮤테이션 hooks — IPC 인자 및 invalidation

| Hook | mutationFn IPC 호출 | invalidate queryKey |
|------|---------------------|---------------------|
| `useCreateTodo` | `create(workspaceId, data)` | `['todo', 'workspace', workspaceId]` |
| `useUpdateTodo` | `update(todoId, data)` ← workspaceId 없음 | `['todo', 'workspace', workspaceId]` |
| `useRemoveTodo` | `remove(todoId)` ← workspaceId 없음 | `['todo', 'workspace', workspaceId]` |
| `useReorderTodoList` | `reorderList(workspaceId, updates)` | `['todo', 'workspace', workspaceId]` |
| `useReorderTodoKanban` | `reorderKanban(workspaceId, updates)` | `['todo', 'workspace', workspaceId]` |
| `useReorderTodoSub` | `reorderSub(parentId, updates)` ← parentId | `['todo', 'workspace', workspaceId]` |

> `useUpdateTodo`/`useRemoveTodo`: mutationFn은 workspaceId를 IPC에 전달하지 않음
> `useReorderTodoSub`: mutationFn은 parentId를 IPC에 전달, onSuccess는 workspaceId로 invalidate

---

## 5. 구현 순서

```
1. todoRepository 테스트 (setup.ts 수정 불필요)
2. todoService 테스트 (repository 전체 mock, toTodoItem용 완전한 Todo mock 반환값 주의)
3. todo-filter 순수 함수 테스트
4. useTodoList hook 테스트
5. useTodoKanban hook 테스트
6. useCompletedTodoList hook 테스트 (rerender 패턴)
7. entities/todo queries 테스트
```

---

## 6. 코드 스타일 규칙

| 항목 | 규칙 |
|------|------|
| Node 테스트 | `describe`, `it`, `expect`, `vi`, `beforeEach` 모두 명시적 import |
| Renderer 테스트 | `import { renderHook, act, waitFor } from '@testing-library/react'` |
| Service mock | `vi.mock(경로, () => ({ ... }))` 최상단 선언 (hoisting 필요) |
| 언어 | 한국어 describe/it 메시지 |
| 코드 스타일 | 세미콜론 없음, 작은따옴표, trailing comma 없음 |

---

## 7. 완료 기준

> `npm run test` — Node 테스트만 실행
> `npm run test:web` — Web 테스트만 실행
> **둘 다 통과해야 완료**

- `npm run test` 전체 통과 (repository + service)
- `npm run test:web` 전체 통과 (filter, hooks, queries)
- `npm run typecheck` 오류 없음
- 총 케이스 수: **70건 이상**
  - Repository: ~20건
  - Service: ~28건 (trim, isDone우선 케이스 추가)
  - 순수 함수: ~15건
  - Hook: ~17건 (빈배열, subTodoMap비필터 케이스 추가)
  - Queries: ~15건
