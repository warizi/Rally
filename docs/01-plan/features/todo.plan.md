# Todo Feature Plan

## Overview

Rally 앱에 Todo(할 일) 기능을 추가한다.
기존 `TodoPage` placeholder를 완성하며, 리스트형과 칸반보드형 두 가지 뷰를 제공한다.
Sub-todo(계층 구조), DnD 정렬, Dialog 등록, 상세 탭 페이지를 포함한다.

---

## 아키텍처 원칙

```
SQLite (todos 테이블)   → Todo 데이터 영구 저장 (workspaceId cascade delete)
IPC (main ↔ renderer)  → window.api.todo.* 브리지 통신
entities/todo           → 타입 + React Query hooks
features/todo           → 리스트/칸반 뷰, DnD, 등록 Dialog
pages/todo              → TodoPage (뷰 전환 컨테이너)
pages/todo-detail       → TodoDetailPage (openTab으로 열리는 상세 페이지)
```

### UI 디자인 시스템 원칙

- **모든 UI 컴포넌트는 shadcn/ui 기반으로 구현** (`src/shared/ui/` style: new-york)
- 커스텀 스타일보다 shadcn 컴포넌트 우선 사용 (Button, Badge, Checkbox, Select, Dialog, DropdownMenu, Separator 등)
- 아이콘은 Lucide React 통일
- 색상/간격은 Tailwind CSS v4 + 프로젝트 CSS 변수 (`--sidebar`, `--foreground` 등) 준수
- 임의 색상값 하드코딩 금지 — 반드시 디자인 토큰 참조

---

## 데이터 스키마

### SQLite `todos` 테이블

| 필드          | 타입                                    | 설명                                                                          |
| ------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| `id`          | text PK                                 | nanoid                                                                        |
| `workspaceId` | text NOT NULL → workspaces.id (cascade) | 워크스페이스 소속, 삭제 시 연쇄 삭제                                          |
| `parentId`    | text NULL → todos.id (cascade)          | 부모 Todo ID. null이면 최상위 Todo. 부모 삭제 시 Sub-todo도 삭제              |
| `title`       | text NOT NULL                           | 할 일 제목                                                                    |
| `description` | text NOT NULL DEFAULT ''                | 상세 설명                                                                     |
| `status`      | text NOT NULL DEFAULT '할일'            | '할일' \| '진행중' \| '완료' \| '보류'                                        |
| `priority`    | text NOT NULL DEFAULT 'medium'          | 'high' \| 'medium' \| 'low'                                                   |
| `isDone`      | integer NOT NULL DEFAULT 0              | boolean (0/1). true일 때 status='완료' 와 연동                                |
| `listOrder`   | real NOT NULL DEFAULT 0                 | 최상위 Todo 리스트형 DnD 정렬 순서                                            |
| `kanbanOrder` | real NOT NULL DEFAULT 0                 | 칸반보드형 DnD 정렬 순서 (최상위: 보드 내 위치 / Sub-todo: 부모 카드 내 위치) |
| `subOrder`    | real NOT NULL DEFAULT 0                 | Sub-todo 리스트형 정렬 순서 (같은 부모 내 순서)                               |
| `createdAt`   | integer (timestamp_ms) NOT NULL         |                                                                               |
| `updatedAt`   | integer (timestamp_ms) NOT NULL         |                                                                               |
| `doneAt`      | integer (timestamp_ms) NULL             | isDone이 true로 변경된 시각                                                   |

> **linkedNotes**: string[] → 추후 구현 예정, 스키마에서 제외

### parentId 동작 규칙

- `parentId = null` → 최상위 Todo
- `parentId = someId` → Sub-todo (1단계 중첩만 지원, v1)
- **부모 Todo 삭제 → Sub-todo도 cascade delete** (DB 레벨 onDelete: cascade)
- 삭제 전 confirm dialog에서 Sub-todo 존재 시 경고 문구 표시

### order 컬럼 사용 기준

| 컬럼          | 대상        | 사용 시점                                    |
| ------------- | ----------- | -------------------------------------------- |
| `listOrder`   | 최상위 Todo | 리스트형 뷰에서 DnD 정렬                     |
| `kanbanOrder` | 최상위 Todo | 칸반보드형 뷰에서 보드 내 위치 결정          |
| `kanbanOrder` | Sub-todo    | 칸반보드형 뷰에서 부모 카드 내 Sub-todo 순서 |
| `subOrder`    | Sub-todo    | 리스트형 뷰에서 Sub-todo DnD 정렬            |

> Sub-todo의 `listOrder`는 사용하지 않음 (0 고정). `kanbanOrder`는 최상위/Sub-todo 모두 사용.

### isDone ↔ status 연동

- `isDone = true` 설정 → `status = '완료'`, `doneAt = new Date()` 자동 설정
- `isDone = false` 설정 → `status = '할일'`, `doneAt = null` 자동 설정
- status를 '완료'로 변경 → `isDone = true`, `doneAt = new Date()` 자동 설정
- status를 '완료' 외로 변경 → `isDone = false`, `doneAt = null` 자동 설정

### Sub-todo Auto-complete

- Sub-todo의 `isDone`이 변경될 때마다 서비스 레이어에서 같은 부모의 Sub-todo 전체를 조회
- **모든 Sub-todo가 `isDone = true`** → 부모 Todo도 자동으로 `isDone = true` (`status = '완료'`, `doneAt` 설정)
- Sub-todo가 하나라도 `isDone = false`로 되돌아오면 → 부모 Todo의 `isDone`은 자동으로 되돌리지 않음 (수동 관리)
- 부모 Todo의 `isDone`을 수동으로 false로 바꾸면 Sub-todo는 영향 없음 (단방향 연동)

### Sub-todo 칸반 정책

- Sub-todo의 `status`는 독립적으로 변경 가능 (체크박스/DetailPage에서)
- **Sub-todo는 칸반 보드에서 독립 카드로 표시되지 않음** — 항상 부모 카드 안에만 표시
- Sub-todo의 `status`가 변경되어도 칸반 보드 이동 없음
- Sub-todo의 `kanbanOrder`는 **부모 카드 내 순서**에 사용 (DnD로 변경 가능)

### 필터 적용 범위

- **필터(status/priority)는 최상위 Todo(parentId null)에만 적용**
- 필터로 최상위 Todo가 숨겨지면 해당 Todo의 Sub-todo도 함께 숨겨짐
- 최상위 Todo가 필터를 통과하면 Sub-todo는 필터 무관하게 전부 표시

---

## IPC 인터페이스

### 채널 목록

```
todo:readByWorkspace (workspaceId)                → TodoItem[]
todo:create         (workspaceId, data)           → TodoItem
todo:update         (todoId, data)                → TodoItem
todo:remove         (todoId)                      → void   (Sub-todo도 cascade 삭제됨)
todo:reorderList    (workspaceId, updates)        → void   (최상위 Todo listOrder 일괄 업데이트)
todo:reorderKanban  (workspaceId, updates)        → void   (kanbanOrder 일괄 업데이트 — 최상위 Todo 보드 정렬 + 보드 간 이동 / Sub-todo 카드 내 정렬 모두 처리)
todo:reorderSub     (parentId, updates)           → void   (Sub-todo subOrder 일괄 업데이트 — 리스트형 전용)
```

### TodoItem 타입 (Preload Bridge)

```typescript
interface TodoItem {
  id: string
  workspaceId: string
  parentId: string | null
  title: string
  description: string
  status: '할일' | '진행중' | '완료' | '보류'
  priority: 'high' | 'medium' | 'low'
  isDone: boolean
  listOrder: number
  kanbanOrder: number
  subOrder: number
  createdAt: Date
  updatedAt: Date
  doneAt: Date | null
}

interface CreateTodoData {
  parentId?: string | null
  title: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
}

// order 필드는 update에서 제외 — reorder 전용 채널로만 변경
interface UpdateTodoData {
  title?: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  isDone?: boolean
}

interface TodoOrderUpdate {
  id: string
  order: number // listOrder | kanbanOrder | subOrder 중 해당 채널에 맞게 사용
  status?: '할일' | '진행중' | '완료' | '보류' // reorderKanban 전용 (보드 간 이동 시)
}

interface TodoAPI {
  readByWorkspace: (workspaceId: string) => Promise<IpcResponse<TodoItem[]>>
  create: (workspaceId: string, data: CreateTodoData) => Promise<IpcResponse<TodoItem>>
  update: (todoId: string, data: UpdateTodoData) => Promise<IpcResponse<TodoItem>>
  remove: (todoId: string) => Promise<IpcResponse<void>>
  reorderList: (workspaceId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  reorderKanban: (workspaceId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
  reorderSub: (parentId: string, updates: TodoOrderUpdate[]) => Promise<IpcResponse<void>>
}
```

---

## Service Layer (Main Process)

### `todoService.readByWorkspace(workspaceId)`

- workspace 유효성 확인 (NotFoundError)
- 해당 workspaceId의 모든 Todo 조회 (최상위: listOrder ASC, Sub-todo: subOrder ASC)
- TodoItem[] 반환 (평탄한 배열 — 트리 조합은 Renderer에서)

### `todoService.create(workspaceId, data)`

- workspace 존재 확인
- title 필수 검증 (빈 문자열 불가)
- nanoid로 id 생성
- `parentId = null` → listOrder / kanbanOrder: 현재 workspaceId 내 최대값 + 1
- `parentId = someId` → subOrder: 같은 parentId 내 최대값 + 1, kanbanOrder: 같은 parentId 내 최대값 + 1, listOrder = 0
- isDone/doneAt 자동 설정 (status 연동)
- DB insert 후 TodoItem 반환

### `todoService.update(todoId, data)`

- todo 존재 확인 (NotFoundError)
- isDone ↔ status 연동 처리
- `isDone = true`로 변경 시 → 같은 parentId의 Sub-todo 전체 조회 → 모두 isDone=true이면 부모 Todo도 자동 완료 (auto-complete)
- updatedAt = new Date()
- DB update 후 TodoItem 반환

### `todoService.remove(todoId)`

- todo 존재 확인
- DB delete (Sub-todo는 DB cascade로 자동 삭제)

### `todoService.reorderList(workspaceId, updates)`

- 최상위 Todo의 listOrder 일괄 업데이트 (DnD 완료 후 호출)

### `todoService.reorderKanban(workspaceId, updates)`

- `kanbanOrder` 일괄 업데이트 (칸반 DnD 완료 후 호출)
- 최상위 Todo: 보드 내 순서 변경 또는 보드 간 이동 (status 포함)
- Sub-todo: 부모 카드 내 순서 변경 (status 변경 없음)

### `todoService.reorderSub(parentId, updates)`

- Sub-todo의 subOrder 일괄 업데이트 (Sub-todo DnD 완료 후 호출)

---

## Renderer Layer (FSD 구조)

### 레이어 구성

```
entities/todo/
  model/types.ts          → TodoItem 타입
  api/queries.ts          → useTodosByWorkspace, useCreateTodo, useUpdateTodo,
                            useRemoveTodo, useReorderTodoList, useReorderTodoKanban,
                            useReorderTodoSub
  index.ts                → barrel export

features/todo/
  manage-todo/
    model/
      use-todo-list.ts    → 리스트형 뷰 정렬/필터/DnD 상태 관리 훅
      use-todo-kanban.ts  → 칸반형 뷰 상태 관리 훅
      todo-filter.ts      → 필터/정렬 타입 및 유틸
    ui/
      TodoListView.tsx        → 리스트형 뷰 컨테이너 (DnD context)
      TodoListItem.tsx        → 리스트 아이템 (collapsible, sub-todo 포함)
      TodoKanbanView.tsx      → 칸반보드 컨테이너 (DnD context, 캐러셀/스크롤)
      TodoKanbanBoard.tsx     → 단일 칸반 보드 (status별)
      TodoKanbanCard.tsx      → 칸반 카드 (collapsible sub-todo 포함)
      TodoFormFields.tsx      → 신규 등록 폼 필드 (CreateTodoDialog 전용)
      CreateTodoDialog.tsx    → 신규 등록 Dialog
      DeleteTodoDialog.tsx    → 삭제 확인 Dialog (Sub-todo 존재 시 경고 포함)
      TodoFilterBar.tsx       → 필터 + 정렬 바
    index.ts

pages/todo/
  ui/TodoPage.tsx         → 리스트/칸반 뷰 전환 + 헤더 (+ 등록 버튼)
  index.ts

pages/todo-detail/
  ui/TodoDetailPage.tsx   → 상세 페이지 (인라인 편집 + Sub-todo 목록)
  index.ts
```

> **EditTodoDialog 제거**: 별도 수정 Dialog 없음. TodoDetailPage에서 바로 인라인 편집 가능.

### FSD Import 규칙 준수

```
pages/todo         → features/todo, entities/todo (허용)
pages/todo-detail  → features/todo, entities/todo (허용)
features/todo      → entities/todo, shared (허용)
entities/todo      → shared (허용)
```

---

## UI 구성

### TodoPage (pages/todo)

- 상단 헤더: "할 일" 제목 + 뷰 전환 버튼(리스트 | 칸반) + "추가" 버튼
- `TodoFilterBar`: 필터(status, priority) + 정렬(중요도/등록순 × 오름/내림차순)
- 뷰 전환: `TodoListView` / `TodoKanbanView` — **local state**로 관리 (탭 닫으면 초기화, 기본값: 리스트)
- TabContainer로 감싸서 container query 적용

### 리스트형 뷰 (`TodoListView`)

**Container Query 반응형:**

| 범위          | 컬럼 구성                                                                              |
| ------------- | -------------------------------------------------------------------------------------- |
| < 400px       | checkbox \| title \| priority badge                                                    |
| 400px ~ 800px | checkbox \| title \| priority badge \| status badge                                    |
| ≥ 800px       | checkbox \| title \| priority badge \| status badge \| doneAt/createdAt \| 더보기 버튼 |

**DnD:**

- `@dnd-kit/core` + `@dnd-kit/sortable` (기존 TabBar DnD와 동일 라이브러리)
- 최상위 Todo 상하 드래그 → `listOrder` 갱신 → `reorderList` IPC 호출
- Sub-todo 상하 드래그 → `subOrder` 갱신 → `reorderSub` IPC 호출
- **필터 적용 중에는 DnD 비활성화** (필터 해제 후 정렬 가능 안내 문구 표시)

**Collapsible (접기/펼치기):**

- 최상위 Todo만 collapsible
- 펼치면 Sub-todo 목록(subOrder ASC) + "하위 추가하기" 버튼 노출
- Sub-todo도 동일 반응형 컬럼 적용
- Sub-todo끼리 DnD로 subOrder 변경 가능

**필터 범위:**

- status/priority 필터는 최상위 Todo에만 적용
- 최상위 Todo가 필터를 통과하면 Sub-todo는 전부 표시 (Sub-todo는 별도 필터 없음)

**등록:**

- 헤더의 "+" 버튼 → `CreateTodoDialog` 열기 (최상위 Todo)
- "하위 추가하기" 클릭 → `CreateTodoDialog` (parentId 사전 설정)

**상세:**

- Todo 제목 클릭 → `openTab({ type: 'todo-detail', pathname: '/todo/:todoId' })`

### 칸반보드형 뷰 (`TodoKanbanView`)

**보드 = status 종류:**

- '할일' | '진행중' | '완료' | '보류' (4개 보드)

**카드 UI (TodoKanbanCard):**

```
┌──────────────────────────┐
│ [✓] 제목               ● │  ← ● = priority badge
│ 설명 텍스트 (truncate)   │
│ 2024-01-15               │  ← createdAt
│ ▶ Sub-todo 2개           │  ← Sub-todo 있을 때만 표시 (접기/펼치기)
└──────────────────────────┘

펼쳤을 때:
┌──────────────────────────┐
│ [✓] 제목               ● │
│ 설명 텍스트 (truncate)   │
│ 2024-01-15               │
│ ▼ Sub-todo 2개           │
│   [✓] 하위 할일 1        │  ← Sub-todo 아이템 (체크박스 + 제목)
│   [ ] 하위 할일 2        │
│   + 하위 추가하기        │
└──────────────────────────┘
```

**DnD:**

- 보드 내 상하 순서 변경 → `kanbanOrder` 갱신 → `reorderKanban` IPC 호출
- 보드 간 이동 → `status` + `kanbanOrder` 갱신 → `reorderKanban` IPC 호출
- **Sub-todo 카드 내 DnD 활성화** → `kanbanOrder` 갱신 → `reorderKanban` IPC 호출
- **필터 적용 중에는 DnD 비활성화**

**Sub-todo 칸반 동작:**

- Sub-todo는 부모 카드 안에서만 표시 (독립 카드 없음)
- Sub-todo끼리 DnD로 `kanbanOrder` 순서 변경 가능 (카드 내에서만)
- Sub-todo 체크박스 토글 시 isDone/status 변경되지만 칸반 보드 이동 없음
- 모든 Sub-todo 완료 시 부모 Todo 자동 완료 (auto-complete) — 칸반 보드 이동은 부모 기준으로 발생

**Container Query 반응형:**

| 범위    | 레이아웃                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------- |
| < 600px | 캐러셀: 한 번에 하나의 보드 표시. 좌/우 넘기기 버튼. DnD 드래그 중 화면 엣지 도달 시 자동 보드 전환 |
| ≥ 600px | 4개 보드 좌우 스크롤 (overflow-x: auto)                                                             |

> **참고**: 600px 기준은 CLAUDE.md 표준(@[400px], @[800px]) 외 추가 breakpoint.
> Tailwind CSS v4 `@container` 쿼리는 임의값을 `@[600px]:` 형태로 바로 사용 가능.

### TodoDetailPage (pages/todo-detail)

- `openTab({ type: 'todo-detail', pathname: '/todo/:todoId' })`으로 진입
- **인라인 편집**: 별도 편집 모드 없이 title, description, status, priority 각 필드를 바로 클릭해서 수정
  - title: 클릭 시 input으로 전환, blur/Enter 시 `update` IPC 호출
  - description: 클릭 시 textarea로 전환, blur 시 `update` IPC 호출
  - status/priority: 클릭 시 Select/DropdownMenu로 전환, 선택 즉시 `update` IPC 호출
  - isDone: checkbox 클릭으로 즉시 토글
- 하단: Sub-todo 목록 (subOrder ASC, 체크박스 + 제목 + 더보기)
- Sub-todo 추가 버튼
- 삭제 버튼 → `DeleteTodoDialog` 표시 후 탭 닫기
- `TodoFormFields`는 CreateTodoDialog에서만 공유 (DetailPage는 인라인 편집 방식이므로 별도 구현)

---

## 라우팅 추가

```typescript
// shared/constants/tab-url.ts 추가
ROUTES.TODO_DETAIL = '/todo/:todoId'

// app/layout/model/pane-routes.tsx 추가
{ pattern: ROUTES.TODO_DETAIL, component: TodoDetailPage }
```

> `TabType`에 `'todo-detail'`은 이미 선언되어 있음 (tab-url.ts 확인)

---

## 구현 범위 (Implementation Scope)

### [0단계] DB 스키마

1. `src/main/db/schema/todo.ts` — todos 테이블 Drizzle 스키마 (subOrder 포함, parentId cascade)
2. `src/main/db/schema/index.ts` — todos export 추가
3. `npm run db:generate && npm run db:migrate`

### [1단계] Main Process

4. `src/main/repositories/todo.ts` — CRUD (findByWorkspaceId, findById, create, update, delete, bulkUpdateListOrder, bulkUpdateKanbanOrder, bulkUpdateSubOrder)
5. `src/main/services/todo.ts` — 비즈니스 로직 (isDone/status 연동, order 계산, 유효성 검증)
6. `src/main/ipc/todo.ts` — IPC 핸들러 등록 (7개 채널)
7. `src/main/index.ts` — registerTodoHandlers() 호출 추가

### [2단계] Preload 타입

8. `src/preload/index.d.ts` — TodoItem, TodoAPI, CreateTodoData, UpdateTodoData, TodoOrderUpdate 타입 추가

### [3단계] entities/todo

9. `src/renderer/src/entities/todo/model/types.ts` — TodoItem 타입
10. `src/renderer/src/entities/todo/api/queries.ts` — React Query hooks (7개)
11. `src/renderer/src/entities/todo/index.ts` — barrel export

### [4단계] features/todo — 공통 컴포넌트

12. `TodoFormFields.tsx` — title, description, status, priority 입력 필드 (CreateTodoDialog 전용)
13. `CreateTodoDialog.tsx` — react-hook-form + zod + shadcn Dialog
14. `DeleteTodoDialog.tsx` — 삭제 확인 Dialog (Sub-todo 존재 시 경고 문구 포함)
15. `TodoFilterBar.tsx` — 필터(status/priority) + 정렬 버튼

### [5단계] features/todo — 리스트 뷰

16. `TodoListItem.tsx` — 리스트 아이템 (반응형, collapsible, DnD sortable)
17. `TodoListView.tsx` — DnD context + 전체 리스트 렌더링 (필터 시 DnD 비활성화)
18. `use-todo-list.ts` — 필터/정렬/DnD 상태 관리 훅

### [6단계] features/todo — 칸반 뷰

19. `TodoKanbanCard.tsx` — 칸반 카드 (Sub-todo 접기/펼치기 포함)
20. `TodoKanbanBoard.tsx` — 단일 보드 (status별)
21. `TodoKanbanView.tsx` — DnD context + 캐러셀/스크롤 반응형 (필터 시 DnD 비활성화)
22. `use-todo-kanban.ts` — 칸반 DnD 상태 관리 훅

### [7단계] pages

23. `pages/todo/ui/TodoPage.tsx` — 뷰 전환(local state) + 헤더 (기존 placeholder 교체)
24. `pages/todo-detail/ui/TodoDetailPage.tsx` — 인라인 편집 + Sub-todo 목록
25. `pages/todo-detail/index.ts` — barrel export

### [8단계] 라우팅 연결

26. `shared/constants/tab-url.ts` — ROUTES.TODO_DETAIL 추가
27. `app/layout/model/pane-routes.tsx` — TodoDetailPage 라우트 추가

---

## 구현 우선순위 (권장 순서)

```
[0단계] DB 스키마 + 마이그레이션
[1단계] Main Process (repository → service → ipc → 등록)
[2단계] Preload 타입
[3단계] entities/todo (React Query hooks)
[4단계] 공통 컴포넌트 (TodoFormFields, CreateTodoDialog, DeleteTodoDialog, TodoFilterBar)
[5단계] 리스트형 뷰 (TodoListView + DnD + Collapsible)
[6단계] 칸반보드형 뷰 (TodoKanbanView + DnD + 캐러셀)
[7단계] TodoPage 완성 + TodoDetailPage (인라인 편집)
[8단계] 라우팅 연결 + 통합 테스트
```

---

## Success Criteria

- [ ] Todo CRUD (생성/조회/수정/삭제) 정상 동작
- [ ] workspaceId cascade delete: 워크스페이스 삭제 시 Todo 전체 삭제
- [ ] parentId cascade delete: 부모 Todo 삭제 시 Sub-todo도 삭제, 삭제 Dialog에서 경고 표시
- [ ] isDone ↔ status 자동 연동 (완료 체크 → status='완료', doneAt 설정)
- [ ] 리스트형 뷰 DnD: 최상위 Todo listOrder 저장, Sub-todo subOrder 저장
- [ ] 리스트형 반응형: 400px/800px 분기 컬럼 변경
- [ ] 리스트형 Collapsible: 펼치면 Sub-todo(subOrder 정렬) + "하위 추가하기" 노출
- [ ] 리스트형 필터(status/priority) + 정렬(중요도/등록순 오름/내림차순) 동작
- [ ] 필터(status/priority)는 최상위 Todo에만 적용, Sub-todo는 전부 표시
- [ ] 필터 적용 중 DnD 비활성화 (리스트형/칸반 모두)
- [ ] Sub-todo 전체 완료 시 부모 Todo 자동 완료 (auto-complete)
- [ ] 칸반보드 DnD: 보드 내 순서 변경 + 보드 간 이동 (status 변경)
- [ ] 칸반보드 카드 내 Sub-todo DnD: kanbanOrder 순서 변경 가능
- [ ] 칸반보드 카드에서 Sub-todo 접기/펼치기 동작
- [ ] 칸반보드 Sub-todo 체크 시 isDone 변경되지만 보드 이동 없음
- [ ] 칸반보드 반응형: 600px 미만 캐러셀, 이상 좌우 스크롤
- [ ] 등록: CreateTodoDialog로 최상위 및 Sub-todo 등록
- [ ] 상세: openTab으로 TodoDetailPage 열림
- [ ] TodoDetailPage 인라인 편집: title/description/status/priority/isDone 즉시 수정 가능
- [ ] 뷰 전환: local state (리스트 ↔ 칸반, 탭 닫으면 리스트로 초기화)
- [ ] FSD Import 규칙 준수 (상위 레이어 → 하위 레이어만 import)
- [ ] TypeScript 컴파일 에러 없음
- [ ] 컨테이너 쿼리 적용 (viewport 쿼리 미사용)
