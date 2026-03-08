# Design: Todo (할 일 기능)

> Plan 참조: `docs/01-plan/features/todo.plan.md`

---

## 0. 구현 우선순위

```
[0단계] DB 스키마 + 마이그레이션
  src/main/db/schema/todo.ts 신규
  src/main/db/schema/index.ts todos export 추가
  npm run db:generate && npm run db:migrate

[1단계] Main Process
  repository → service → ipc → index.ts 등록

[2단계] Preload 타입
  TodoItem, CreateTodoData, UpdateTodoData, TodoOrderUpdate, TodoAPI 추가

[3단계] entities/todo (React Query)
  types → queries → index

[4단계] features/todo — 공통 컴포넌트
  TodoFormFields → CreateTodoDialog → DeleteTodoDialog → TodoFilterBar

[5단계] features/todo — 리스트 뷰
  use-todo-list → TodoListItem → TodoListView

[6단계] features/todo — 칸반 뷰
  use-todo-kanban → TodoKanbanCard → TodoKanbanBoard → TodoKanbanView

[7단계] pages
  TodoPage (기존 placeholder 교체) → TodoDetailPage (신규)

[8단계] 라우팅 연결
  tab-url.ts ROUTES.TODO_DETAIL 추가 → pane-routes.tsx TodoDetailPage 추가
```

---

## 1. DB Schema

### `src/main/db/schema/todo.ts`

```typescript
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  // self-referential FK: lazy reference 필수 (초기화 순서 문제 방지)
  parentId: text('parent_id').references((): AnySQLiteColumn => todos.id, {
    onDelete: 'cascade'
  }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['할일', '진행중', '완료', '보류'] })
    .notNull()
    .default('할일'),
  priority: text('priority', { enum: ['high', 'medium', 'low'] })
    .notNull()
    .default('medium'),
  isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
  listOrder: real('list_order').notNull().default(0),
  kanbanOrder: real('kanban_order').notNull().default(0),
  subOrder: real('sub_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  doneAt: integer('done_at', { mode: 'timestamp_ms' })
})
```

> **self-referential FK**: Drizzle ORM에서 같은 테이블을 자기 참조할 때
> `references((): AnySQLiteColumn => todos.id, ...)` 형태의 lazy reference를 사용한다.
> 일반 `references(() => todos.id)` 사용 시 초기화 순서 문제로 에러 발생.

### `src/main/db/schema/index.ts` 수정

```typescript
import { workspaces } from './workspace'
import { tabSessions } from './tab-session'
import { tabSnapshots } from './tab-snapshot'
import { folders } from './folder'
import { notes } from './note'
import { todos } from './todo'

export { workspaces, tabSessions, tabSnapshots, folders, notes, todos }
```

---

## 2. Repository

### `src/main/repositories/todo.ts`

```typescript
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db'
import { todos } from '../db/schema'

export type Todo = typeof todos.$inferSelect
export type TodoInsert = typeof todos.$inferInsert

export const todoRepository = {
  findByWorkspaceId(workspaceId: string): Todo[] {
    return db.select().from(todos).where(eq(todos.workspaceId, workspaceId)).all()
  },

  findById(id: string): Todo | undefined {
    return db.select().from(todos).where(eq(todos.id, id)).get()
  },

  findByParentId(parentId: string): Todo[] {
    return db.select().from(todos).where(eq(todos.parentId, parentId)).all()
  },

  findTopLevelByWorkspace(workspaceId: string): Todo[] {
    return db
      .select()
      .from(todos)
      .where(and(eq(todos.workspaceId, workspaceId), isNull(todos.parentId)))
      .all()
  },

  create(data: TodoInsert): Todo {
    return db.insert(todos).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        Todo,
        | 'title'
        | 'description'
        | 'status'
        | 'priority'
        | 'isDone'
        | 'listOrder'
        | 'kanbanOrder'
        | 'subOrder'
        | 'updatedAt'
        | 'doneAt'
      >
    >
  ): Todo | undefined {
    return db.update(todos).set(data).where(eq(todos.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(todos).where(eq(todos.id, id)).run()
  },

  /**
   * listOrder 일괄 업데이트 (리스트형 DnD)
   */
  bulkUpdateListOrder(updates: { id: string; order: number }[]): void {
    if (updates.length === 0) return
    const now = Date.now()
    const stmt = db.$client.prepare(`UPDATE todos SET list_order = ?, updated_at = ? WHERE id = ?`)
    db.$client.transaction(() => {
      for (const u of updates) {
        stmt.run(u.order, now, u.id)
      }
    })()
  },

  /**
   * kanbanOrder + status 일괄 업데이트 (칸반 DnD)
   * status가 undefined이면 kanbanOrder만 업데이트
   */
  bulkUpdateKanbanOrder(
    updates: {
      id: string
      order: number
      status?: string
      isDone?: boolean
      doneAt?: number | null
    }[]
  ): void {
    if (updates.length === 0) return
    const now = Date.now()
    // prepare 문은 트랜잭션/루프 밖에서 한 번만 생성
    // status 변경 시 isDone/doneAt도 함께 동기화 (status='완료' ↔ isDone 연동)
    const stmtWithStatus = db.$client.prepare(
      `UPDATE todos SET kanban_order = ?, status = ?, is_done = ?, done_at = ?, updated_at = ? WHERE id = ?`
    )
    const stmtOrderOnly = db.$client.prepare(
      `UPDATE todos SET kanban_order = ?, updated_at = ? WHERE id = ?`
    )
    db.$client.transaction(() => {
      for (const u of updates) {
        if (u.status !== undefined) {
          stmtWithStatus.run(u.order, u.status, u.isDone ? 1 : 0, u.doneAt ?? null, now, u.id)
        } else {
          stmtOrderOnly.run(u.order, now, u.id)
        }
      }
    })()
  },

  /**
   * subOrder 일괄 업데이트 (Sub-todo 리스트형 DnD)
   */
  bulkUpdateSubOrder(updates: { id: string; order: number }[]): void {
    if (updates.length === 0) return
    const now = Date.now()
    const stmt = db.$client.prepare(`UPDATE todos SET sub_order = ?, updated_at = ? WHERE id = ?`)
    db.$client.transaction(() => {
      for (const u of updates) {
        stmt.run(u.order, now, u.id)
      }
    })()
  }
}
```

---

## 3. Service

### `src/main/services/todo.ts`

```typescript
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { todoRepository } from '../repositories/todo'
import { workspaceRepository } from '../repositories/workspace'
import type { Todo } from '../repositories/todo'

export interface TodoItem {
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

export interface CreateTodoData {
  parentId?: string | null
  title: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
}

export interface UpdateTodoData {
  title?: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  isDone?: boolean
}

export interface TodoOrderUpdate {
  id: string
  order: number
  status?: '할일' | '진행중' | '완료' | '보류' // reorderKanban 전용
}

function toTodoItem(todo: Todo): TodoItem {
  return {
    id: todo.id,
    workspaceId: todo.workspaceId,
    parentId: todo.parentId,
    title: todo.title,
    description: todo.description,
    status: todo.status as TodoItem['status'],
    priority: todo.priority as TodoItem['priority'],
    isDone: todo.isDone,
    listOrder: todo.listOrder,
    kanbanOrder: todo.kanbanOrder,
    subOrder: todo.subOrder,
    createdAt: todo.createdAt instanceof Date ? todo.createdAt : new Date(todo.createdAt),
    updatedAt: todo.updatedAt instanceof Date ? todo.updatedAt : new Date(todo.updatedAt),
    doneAt: todo.doneAt ? (todo.doneAt instanceof Date ? todo.doneAt : new Date(todo.doneAt)) : null
  }
}

type DoneFields = {
  isDone?: boolean
  status?: '할일' | '진행중' | '완료' | '보류'
  doneAt?: Date | null
}

/** isDone/status/doneAt 연동 계산 */
function resolveDoneFields(data: UpdateTodoData): DoneFields {
  const result: DoneFields = {}

  if (data.isDone !== undefined) {
    result.isDone = data.isDone
    result.status = data.isDone ? '완료' : '할일'
    result.doneAt = data.isDone ? new Date() : null
  } else if (data.status !== undefined) {
    result.status = data.status // 항상 status 반영
    if (data.status === '완료') {
      result.isDone = true
      result.doneAt = new Date()
    } else {
      result.isDone = false
      result.doneAt = null
    }
  }

  return result
}

export const todoService = {
  readByWorkspace(workspaceId: string): TodoItem[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    return todoRepository.findByWorkspaceId(workspaceId).map(toTodoItem)
  },

  create(workspaceId: string, data: CreateTodoData): TodoItem {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)

    if (!data.title.trim()) {
      throw new ValidationError('제목은 필수입니다')
    }

    const parentId = data.parentId ?? null
    const now = new Date()
    const status = data.status ?? '할일'
    const isDone = status === '완료'
    const doneAt = isDone ? now : null

    let listOrder = 0
    let kanbanOrder = 0
    let subOrder = 0

    if (parentId === null) {
      // 최상위: 현재 workspace 내 최대 listOrder/kanbanOrder + 1
      const topLevel = todoRepository.findTopLevelByWorkspace(workspaceId)
      listOrder = topLevel.length > 0 ? Math.max(...topLevel.map((t) => t.listOrder)) + 1 : 0
      kanbanOrder = topLevel.length > 0 ? Math.max(...topLevel.map((t) => t.kanbanOrder)) + 1 : 0
    } else {
      // Sub-todo: 같은 부모 내 최대 subOrder/kanbanOrder + 1
      const parent = todoRepository.findById(parentId)
      if (!parent) throw new NotFoundError(`Parent todo not found: ${parentId}`)
      const siblings = todoRepository.findByParentId(parentId)
      subOrder = siblings.length > 0 ? Math.max(...siblings.map((t) => t.subOrder)) + 1 : 0
      kanbanOrder = siblings.length > 0 ? Math.max(...siblings.map((t) => t.kanbanOrder)) + 1 : 0
      listOrder = 0 // Sub-todo listOrder 미사용
    }

    const row = todoRepository.create({
      id: nanoid(),
      workspaceId,
      parentId,
      title: data.title.trim(),
      description: data.description ?? '',
      status,
      priority: data.priority ?? 'medium',
      isDone,
      listOrder,
      kanbanOrder,
      subOrder,
      createdAt: now,
      updatedAt: now,
      doneAt
    })

    return toTodoItem(row)
  },

  update(todoId: string, data: UpdateTodoData): TodoItem {
    const todo = todoRepository.findById(todoId)
    if (!todo) throw new NotFoundError(`Todo not found: ${todoId}`)

    const doneFields = resolveDoneFields(data)
    const now = new Date()

    const updated = todoRepository.update(todoId, {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...doneFields,
      updatedAt: now
    })!

    // Auto-complete: Sub-todo가 isDone=true로 변경 시 부모 전체 완료 여부 확인
    // 단방향(하위→부모): 서브-투두를 다시 미완료로 바꿔도 부모는 자동 복원되지 않음
    // 이후 부모를 수동으로 미완료 처리해야 함 (의도된 UX)
    if (doneFields.isDone === true && todo.parentId) {
      const siblings = todoRepository.findByParentId(todo.parentId)
      const allDone = siblings.every((s) => (s.id === todoId ? true : s.isDone))
      if (allDone) {
        const parentNow = new Date()
        todoRepository.update(todo.parentId, {
          isDone: true,
          status: '완료',
          doneAt: parentNow,
          updatedAt: parentNow
        })
      }
    }

    return toTodoItem(updated)
  },

  remove(todoId: string): void {
    const todo = todoRepository.findById(todoId)
    if (!todo) throw new NotFoundError(`Todo not found: ${todoId}`)
    // Sub-todo는 DB cascade(onDelete: 'cascade')로 자동 삭제
    todoRepository.delete(todoId)
  },

  reorderList(workspaceId: string, updates: TodoOrderUpdate[]): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    todoRepository.bulkUpdateListOrder(updates.map((u) => ({ id: u.id, order: u.order })))
  },

  reorderKanban(workspaceId: string, updates: TodoOrderUpdate[]): void {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError(`Workspace not found: ${workspaceId}`)
    const now = Date.now()
    todoRepository.bulkUpdateKanbanOrder(
      updates.map((u) => {
        if (u.status !== undefined) {
          // 보드 간 이동: isDone/doneAt을 status와 동기화
          return {
            id: u.id,
            order: u.order,
            status: u.status,
            isDone: u.status === '완료',
            doneAt: u.status === '완료' ? now : null
          }
        }
        return { id: u.id, order: u.order }
      })
    )
  },

  reorderSub(parentId: string, updates: TodoOrderUpdate[]): void {
    const parent = todoRepository.findById(parentId)
    if (!parent) throw new NotFoundError(`Parent todo not found: ${parentId}`)
    todoRepository.bulkUpdateSubOrder(updates.map((u) => ({ id: u.id, order: u.order })))
  }
}
```

---

## 4. IPC Handler

### `src/main/ipc/todo.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { todoService } from '../services/todo'
import type { CreateTodoData, UpdateTodoData, TodoOrderUpdate } from '../services/todo'

export function registerTodoHandlers(): void {
  ipcMain.handle(
    'todo:readByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string): IpcResponse =>
      handle(() => todoService.readByWorkspace(workspaceId))
  )

  ipcMain.handle(
    'todo:create',
    (_: IpcMainInvokeEvent, workspaceId: string, data: CreateTodoData): IpcResponse =>
      handle(() => todoService.create(workspaceId, data))
  )

  ipcMain.handle(
    'todo:update',
    (_: IpcMainInvokeEvent, todoId: string, data: UpdateTodoData): IpcResponse =>
      handle(() => todoService.update(todoId, data))
  )

  ipcMain.handle(
    'todo:remove',
    (_: IpcMainInvokeEvent, todoId: string): IpcResponse => handle(() => todoService.remove(todoId))
  )

  ipcMain.handle(
    'todo:reorderList',
    (_: IpcMainInvokeEvent, workspaceId: string, updates: TodoOrderUpdate[]): IpcResponse =>
      handle(() => todoService.reorderList(workspaceId, updates))
  )

  ipcMain.handle(
    'todo:reorderKanban',
    (_: IpcMainInvokeEvent, workspaceId: string, updates: TodoOrderUpdate[]): IpcResponse =>
      handle(() => todoService.reorderKanban(workspaceId, updates))
  )

  ipcMain.handle(
    'todo:reorderSub',
    (_: IpcMainInvokeEvent, parentId: string, updates: TodoOrderUpdate[]): IpcResponse =>
      handle(() => todoService.reorderSub(parentId, updates))
  )
}
```

### `src/main/index.ts` 수정

기존 `registerNoteHandlers()` 아래에 추가:

```typescript
import { registerTodoHandlers } from './ipc/todo'

// app.whenReady() 내부에 추가:
registerTodoHandlers()
```

---

## 5. Preload 타입

### `src/preload/index.d.ts` 수정

기존 `NoteAPI` 인터페이스 아래에 추가:

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

// order 필드는 reorder 전용 채널로만 변경
interface UpdateTodoData {
  title?: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  isDone?: boolean
}

interface TodoOrderUpdate {
  id: string
  order: number
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

`interface API` 수정 — `todo` 필드 추가:

```typescript
interface API {
  note: NoteAPI
  folder: FolderAPI
  tabSession: TabSessionAPI
  tabSnapshot: TabSnapshotAPI
  workspace: WorkspaceAPI
  todo: TodoAPI
}
```

---

## 6. entities/todo

### `src/renderer/src/entities/todo/model/types.ts`

```typescript
export interface TodoItem {
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

export interface CreateTodoData {
  parentId?: string | null
  title: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
}

export interface UpdateTodoData {
  title?: string
  description?: string
  status?: '할일' | '진행중' | '완료' | '보류'
  priority?: 'high' | 'medium' | 'low'
  isDone?: boolean
}

export interface TodoOrderUpdate {
  id: string
  order: number
  status?: '할일' | '진행중' | '완료' | '보류'
}

export const TODO_STATUS = ['할일', '진행중', '완료', '보류'] as const
export type TodoStatus = (typeof TODO_STATUS)[number]

export const TODO_PRIORITY = ['high', 'medium', 'low'] as const
export type TodoPriority = (typeof TODO_PRIORITY)[number]
```

### `src/renderer/src/entities/todo/api/queries.ts`

```typescript
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { TodoItem, CreateTodoData, UpdateTodoData, TodoOrderUpdate } from '../model/types'

const TODO_KEY = 'todo'

export function useTodosByWorkspace(workspaceId: string | null): UseQueryResult<TodoItem[]> {
  return useQuery({
    queryKey: [TODO_KEY, 'workspace', workspaceId],
    queryFn: async (): Promise<TodoItem[]> => {
      const res: IpcResponse<TodoItem[]> = await window.api.todo.readByWorkspace(workspaceId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useCreateTodo(): UseMutationResult<
  TodoItem | undefined,
  Error,
  { workspaceId: string; data: CreateTodoData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, data }) => {
      const res: IpcResponse<TodoItem> = await window.api.todo.create(workspaceId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useUpdateTodo(): UseMutationResult<
  TodoItem | undefined,
  Error,
  { workspaceId: string; todoId: string; data: UpdateTodoData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ todoId, data }) => {
      const res: IpcResponse<TodoItem> = await window.api.todo.update(todoId, data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useRemoveTodo(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; todoId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ todoId }) => {
      const res: IpcResponse<void> = await window.api.todo.remove(todoId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReorderTodoList(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; updates: TodoOrderUpdate[] }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, updates }) => {
      const res: IpcResponse<void> = await window.api.todo.reorderList(workspaceId, updates)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReorderTodoKanban(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; updates: TodoOrderUpdate[] }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, updates }) => {
      const res: IpcResponse<void> = await window.api.todo.reorderKanban(workspaceId, updates)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}

export function useReorderTodoSub(): UseMutationResult<
  void,
  Error,
  { workspaceId: string; parentId: string; updates: TodoOrderUpdate[] }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ parentId, updates }) => {
      const res: IpcResponse<void> = await window.api.todo.reorderSub(parentId, updates)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: [TODO_KEY, 'workspace', workspaceId] })
    }
  })
}
```

### `src/renderer/src/entities/todo/index.ts`

```typescript
export type {
  TodoItem,
  CreateTodoData,
  UpdateTodoData,
  TodoOrderUpdate,
  TodoStatus,
  TodoPriority
} from './model/types'
export { TODO_STATUS, TODO_PRIORITY } from './model/types'
export {
  useTodosByWorkspace,
  useCreateTodo,
  useUpdateTodo,
  useRemoveTodo,
  useReorderTodoList,
  useReorderTodoKanban,
  useReorderTodoSub
} from './api/queries'
```

---

## 7. features/todo — 공통 모델

### `src/renderer/src/features/todo/manage-todo/model/todo-filter.ts`

```typescript
import type { TodoItem, TodoStatus, TodoPriority } from '@entities/todo'

export interface TodoFilter {
  status: TodoStatus | 'all'
  priority: TodoPriority | 'all'
}

export interface TodoSort {
  by: 'priority' | 'createdAt'
  dir: 'asc' | 'desc'
}

export const DEFAULT_FILTER: TodoFilter = { status: 'all', priority: 'all' }
export const DEFAULT_SORT: TodoSort = { by: 'createdAt', dir: 'asc' }

export function isFilterActive(filter: TodoFilter): boolean {
  return filter.status !== 'all' || filter.priority !== 'all'
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function applyFilterAndSort(
  todos: TodoItem[],
  filter: TodoFilter,
  sort: TodoSort
): TodoItem[] {
  const filtered = todos.filter((t) => {
    if (filter.status !== 'all' && t.status !== filter.status) return false
    if (filter.priority !== 'all' && t.priority !== filter.priority) return false
    return true
  })

  return [...filtered].sort((a, b) => {
    let cmp = 0
    if (sort.by === 'priority') {
      cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0)
    } else {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
    return sort.dir === 'asc' ? cmp : -cmp
  })
}
```

### `src/renderer/src/features/todo/manage-todo/model/use-todo-list.ts`

```typescript
import { useState, useMemo } from 'react'
import { applyFilterAndSort, DEFAULT_FILTER, DEFAULT_SORT, isFilterActive } from './todo-filter'
import type { TodoFilter, TodoSort } from './todo-filter'
import type { TodoItem } from '@entities/todo'

export function useTodoList(allTodos: TodoItem[]) {
  const [filter, setFilter] = useState<TodoFilter>(DEFAULT_FILTER)
  const [sort, setSort] = useState<TodoSort>(DEFAULT_SORT)

  const topLevel = useMemo(() => allTodos.filter((t) => t.parentId === null), [allTodos])

  const subTodoMap = useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    for (const t of allTodos) {
      if (t.parentId) {
        const arr = map.get(t.parentId) ?? []
        arr.push(t)
        map.set(t.parentId, arr)
      }
    }
    // subOrder ASC 정렬
    for (const [, items] of map) {
      items.sort((a, b) => a.subOrder - b.subOrder)
    }
    return map
  }, [allTodos])

  const filteredTopLevel = useMemo(
    () => applyFilterAndSort(topLevel, filter, sort),
    [topLevel, filter, sort]
  )

  const filterActive = useMemo(() => isFilterActive(filter), [filter])

  return { filter, setFilter, sort, setSort, filteredTopLevel, subTodoMap, filterActive }
}
```

### `src/renderer/src/features/todo/manage-todo/model/use-todo-kanban.ts`

```typescript
import { useState, useMemo } from 'react'
import { DEFAULT_FILTER } from './todo-filter'
import type { TodoFilter } from './todo-filter'
import type { TodoItem, TodoStatus } from '@entities/todo'

export const KANBAN_COLUMNS: TodoStatus[] = ['할일', '진행중', '완료', '보류']

export function useTodoKanban(allTodos: TodoItem[]) {
  const [filter, setFilter] = useState<TodoFilter>(DEFAULT_FILTER)
  const [activeColumn, setActiveColumn] = useState(0) // 캐러셀 현재 보드 인덱스

  const topLevel = useMemo(() => allTodos.filter((t) => t.parentId === null), [allTodos])

  const subTodoMap = useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    for (const t of allTodos) {
      if (t.parentId) {
        const arr = map.get(t.parentId) ?? []
        arr.push(t)
        map.set(t.parentId, arr)
      }
    }
    // kanbanOrder ASC 정렬
    for (const [, items] of map) {
      items.sort((a, b) => a.kanbanOrder - b.kanbanOrder)
    }
    return map
  }, [allTodos])

  // 칸반에서 status 필터는 보드 자체가 status별 분류이므로 불필요
  // priority 필터만 적용 (filter dependency 추가)
  const columnMap = useMemo(() => {
    const map = new Map<TodoStatus, TodoItem[]>()
    for (const col of KANBAN_COLUMNS) {
      const items = topLevel
        .filter((t) => t.status === col)
        .filter((t) => filter.priority === 'all' || t.priority === filter.priority)
        .sort((a, b) => a.kanbanOrder - b.kanbanOrder)
      map.set(col, items)
    }
    return map
  }, [topLevel, filter])

  // filterActive: kanban에서는 priority 필터만 DnD 비활성화 기준
  // isFilterActive()는 status도 포함하므로 직접 priority만 체크
  // (status 필터는 TodoFilterBar에서 kanban 시 숨김 처리로 선택 불가 → 일관성 보장)
  const filterActive = useMemo(() => filter.priority !== 'all', [filter])

  return {
    filter,
    setFilter,
    activeColumn,
    setActiveColumn,
    columnMap,
    subTodoMap,
    filterActive
  }
}
```

---

## 8. features/todo — UI 컴포넌트 명세

### `TodoFilterBar.tsx`

- **props**:
  ```typescript
  filter: TodoFilter
  onFilterChange: (filter: TodoFilter) => void
  sort: TodoSort
  onSortChange: (sort: TodoSort) => void
  showSort?: boolean    // 기본값 true — 칸반 뷰에서 false 전달 시 sort UI 숨김
  showStatus?: boolean  // 기본값 true — 칸반 뷰에서 false 전달 시 status 필터 숨김
  ```
- **shadcn 컴포넌트**: `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `Button`, `ToggleGroup`, `ToggleGroupItem`
- `showStatus`가 true일 때만: status 필터 Select 표시 (기본값 true)
- priority 필터 Select (항상 표시)
- `showSort`가 true일 때만: 정렬 기준(중요도/등록순) ToggleGroup, 방향(오름/내림) Button
- 필터 활성 시 필터 초기화 버튼(X) 표시

### `TodoFormFields.tsx` (CreateTodoDialog 전용)

- **props**: `control: Control<CreateTodoFormValues>`, `errors: FieldErrors<CreateTodoFormValues>`
- **zod 스키마**:
  ```typescript
  const createTodoSchema = z.object({
    title: z.string().min(1, '제목을 입력하세요').max(200),
    description: z.string().optional().default(''),
    status: z.enum(['할일', '진행중', '완료', '보류']).default('할일'),
    priority: z.enum(['high', 'medium', 'low']).default('medium')
  })
  type CreateTodoFormValues = z.infer<typeof createTodoSchema>
  ```
- title: `Input`, description: `Textarea`, status: `Select`, priority: `Select`
- shadcn `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` 래퍼 사용

### `CreateTodoDialog.tsx`

- **props**: `workspaceId: string`, `parentId?: string | null`, `trigger: React.ReactNode`, `defaultStatus?: TodoStatus`
- **상태**: `open: boolean`
- **폼 초기값**: `defaultStatus`를 `useForm`의 `defaultValues`로 전달

  ```tsx
  const form = useForm<CreateTodoFormValues>({
    resolver: zodResolver(createTodoSchema),
    defaultValues: {
      title: '',
      description: '',
      status: defaultStatus ?? '할일',
      priority: 'medium'
    }
  })
  ```

  - `defaultStatus`가 변경될 수 있으므로 Dialog가 열릴 때 전체 필드를 재초기화:
    ```tsx
    form.reset({ title: '', description: '', status: defaultStatus ?? '할일', priority: 'medium' })
    ```

- **제출**: `useCreateTodo().mutate({ workspaceId, data: { ...values, parentId } })`
- **성공 시**: Dialog 닫기 + 폼 리셋
- **shadcn**: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `Button`, `Form`

### `DeleteTodoDialog.tsx`

- **props**: `todoId: string`, `workspaceId: string`, `hasSubTodos: boolean`, `trigger: React.ReactNode`, `onDeleted?: () => void`
- **경고**: `hasSubTodos`가 true이면 "하위 할 일도 함께 삭제됩니다" 문구 표시
- **제출**: `useRemoveTodo().mutate({ workspaceId, todoId }, { onSuccess: onDeleted })`
- **shadcn**: `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`

### `TodoListItem.tsx`

- **props**: `todo: TodoItem`, `subTodos: TodoItem[]`, `workspaceId: string`, `onTitleClick: () => void`
  - `onTitleClick`: pages 레이어에서 주입 — FSD 규칙상 features/todo는 features/tap-system을 직접 import 불가
- **DnD**: `useSortable({ id: todo.id })` — transform, transition, attributes, listeners, setNodeRef 적용
- **반응형 컬럼** (container query, `@container`는 `TabContainer`에서 제공):

  | 컬럼 | < 400px                        | 400~800px      | ≥ 800px                         |
  | ---- | ------------------------------ | -------------- | ------------------------------- |
  | 표시 | Checkbox, 제목, priority Badge | + status Badge | + doneAt/createdAt, 더보기 버튼 |

  ```tsx
  <div className="grid grid-cols-[auto_1fr_auto] @[400px]:grid-cols-[auto_1fr_auto_auto] @[800px]:grid-cols-[auto_1fr_auto_auto_auto_auto]">
  ```

- **Collapsible** (shadcn `Collapsible`): Sub-todo 있을 때만 접기/펼치기 트리거 표시
- **체크박스 토글**: `useUpdateTodo().mutate({ workspaceId, todoId: todo.id, data: { isDone: !todo.isDone } })`
- **제목 클릭**: `onTitleClick()` (prop으로 주입받은 콜백 호출)
- **더보기 DropdownMenu**: "상세 보기"(→ `onTitleClick()` 호출), "삭제"(→DeleteTodoDialog)
- **Sub-todo DnD**: Collapsible 내부에 자체 `DndContext` + `SortableContext` (subOrder 기준 정렬)

  ```tsx
  function handleSubDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = subTodos.findIndex((t) => t.id === active.id)
    const newIndex = subTodos.findIndex((t) => t.id === over.id)
    if (oldIndex === newIndex) return
    const reordered = arrayMove(subTodos, oldIndex, newIndex)
    reorderSub.mutate({
      workspaceId,
      parentId: todo.id,
      updates: reordered.map((t, i) => ({ id: t.id, order: i }))
    })
  }
  // reorderSub = useReorderTodoSub()
  ```

  - 부모 `DndContext`(TodoListView)와 완전히 격리 — 서브-투두 드래그가 상위 onDragEnd를 발화시키지 않음

### `TodoListView.tsx`

- **props**: `todos: TodoItem[]`, `subTodoMap: Map<string, TodoItem[]>`, `workspaceId: string`, `filterActive: boolean`, `onItemClick: (todoId: string) => void`
  - `onItemClick`: `TodoListItem`의 `onTitleClick`으로 전달
- **DnD 구조**:
  ```tsx
  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
      {todos.map(todo => <TodoListItem ... />)}
    </SortableContext>
  </DndContext>
  ```
- **onDragEnd**: `arrayMove` → 새 순서에서 `listOrder` 정수 재인덱싱(0, 1, 2...) → `useReorderTodoList().mutate()`
- **빈 상태**: `todos.length === 0`일 때 안내 문구 표시
  ```tsx
  {
    todos.length === 0 && (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {filterActive ? '필터 조건에 맞는 할 일이 없습니다' : '할 일이 없습니다'}
      </div>
    )
  }
  ```
- **필터 비활성화**: `filterActive`가 true이면 DnD sensors를 빈 배열로 교체하고 안내 문구 표시
  ```tsx
  const sensors = useSensors(
    ...(filterActive ? [] : [useSensor(PointerSensor), useSensor(KeyboardSensor)])
  )
  ```

### `TodoKanbanCard.tsx`

- **props**: `todo: TodoItem`, `subTodos: TodoItem[]`, `workspaceId: string`, `onTitleClick: () => void`
  - `onTitleClick`: pages 레이어에서 주입 (FSD — TodoListItem과 동일한 패턴)
- **DnD**: `useSortable({ id: todo.id })` (카드 드래그)
- **shadcn**: `Card`, `CardContent`, `Checkbox`, `Badge`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
- **카드 구조**:
  ```
  ┌──────────────────────────────────────┐
  │ [✓] 제목(클릭→상세)        [priority]│
  │ description (line-clamp-2)           │
  │ createdAt (muted, text-xs)           │
  │ ▶ Sub-todo N개 (Collapsible)         │
  │   [✓] 하위 항목 1  (DnD sortable)   │
  │   [ ] 하위 항목 2                    │
  │   + 하위 추가하기                    │
  └──────────────────────────────────────┘
  ```
- **제목 클릭**: `onTitleClick()` 호출 (TodoListItem과 동일, 상세 페이지 이동)
- **Sub-todo DnD**: 자체 `DndContext` + `SortableContext` (kanbanOrder 기준 정렬)

  ```tsx
  function handleSubDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = subTodos.findIndex((t) => t.id === active.id)
    const newIndex = subTodos.findIndex((t) => t.id === over.id)
    if (oldIndex === newIndex) return
    const reordered = arrayMove(subTodos, oldIndex, newIndex)
    reorderKanban.mutate({
      workspaceId,
      updates: reordered.map((t, i) => ({ id: t.id, order: i }))
    })
  }
  // reorderKanban = useReorderTodoKanban()
  ```

  - 부모 `DndContext`(TodoKanbanView)와 완전히 격리 — 카드 드래그 중 서브-투두 DnD가 충돌하지 않음
  - 서브-투두는 카드 내부에서만 이동 (보드 간 이동 없음)

- **`+ 하위 추가하기` 버튼**: Collapsible 내 하단에 위치, `CreateTodoDialog` with `parentId={todo.id}`
  ```tsx
  <CreateTodoDialog
    workspaceId={workspaceId}
    parentId={todo.id}
    trigger={
      <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
        + 하위 추가하기
      </Button>
    }
  />
  ```
- **priority Badge 색상**: high=`destructive`, medium=`secondary`, low=`outline`

### `TodoKanbanBoard.tsx`

- **props**: `status: TodoStatus`, `todos: TodoItem[]`, `subTodoMap: Map<string, TodoItem[]>`, `workspaceId: string`, `onItemClick: (todoId: string) => void`
- **DnD 드롭 영역**: `useDroppable({ id: status })`
- **shadcn**: `Card` (보드 컨테이너), `Badge` (카드 수), `ScrollArea` (카드 목록 스크롤)
- **헤더**: status 한글 이름 + 카드 수 Badge
- **보드 내 DnD**: `SortableContext` (kanbanOrder 기준, verticalListSortingStrategy)
- **"+" 추가 버튼**: `CreateTodoDialog` trigger (defaultStatus 사전 설정)
  ```tsx
  <CreateTodoDialog
    workspaceId={workspaceId}
    defaultStatus={status}
    trigger={
      <Button variant="ghost" size="sm">
        + 추가
      </Button>
    }
  />
  ```
- **카드 전달**: `<TodoKanbanCard onTitleClick={() => onItemClick(todo.id)} />`

### `TodoKanbanView.tsx`

- **props**: `todos: TodoItem[]`, `subTodoMap: Map<string, TodoItem[]>`, `columnMap: Map<TodoStatus, TodoItem[]>`, `workspaceId: string`, `filterActive: boolean`, `activeColumn: number`, `onColumnChange: (i: number) => void`, `onItemClick: (todoId: string) => void`
  - `columnMap`: `useTodoKanban`에서 계산된 status별 top-level 투두 맵 — `handleDragEnd`에서 인덱스 계산에 사용
- **반응형**:

  ```tsx
  import { ChevronLeft, ChevronRight } from 'lucide-react'

  {/* < @[600px]: 캐러셀 */}
  <div className="@[600px]:hidden">
    <div className="flex items-center justify-between mb-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onColumnChange(Math.max(0, activeColumn - 1))}
        disabled={activeColumn === 0}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium">{KANBAN_COLUMNS[activeColumn]}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onColumnChange(Math.min(3, activeColumn + 1))}
        disabled={activeColumn === 3}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
    <TodoKanbanBoard status={KANBAN_COLUMNS[activeColumn]} ... />
  </div>

  {/* ≥ @[600px]: 가로 스크롤 */}
  <div className="hidden @[600px]:flex gap-3 overflow-x-auto pb-2">
    {KANBAN_COLUMNS.map(status => <TodoKanbanBoard key={status} status={status} ... />)}
  </div>
  ```

- **DnD 최상위 Context**:
  ```tsx
  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    ...boards...
  </DndContext>
  ```
- **onDragEnd**: 출발 container와 도착 container(status) 비교
  - 같은 보드: `kanbanOrder`만 재계산 → `reorderKanban` (status 미포함)
  - 다른 보드: `kanbanOrder` + `status` 변경 → `reorderKanban` (status 포함)
- **필터 비활성화**: `filterActive`가 true이면 sensors 비워 DnD 비활성화

---

## 9. pages/todo

### `src/renderer/src/pages/todo/ui/TodoPage.tsx`

```tsx
import { useState } from 'react'
import { LayoutList, LayoutGrid } from 'lucide-react'
import { TabContainer } from '@shared/ui/tab-container'
import { Button } from '@shared/ui/button'
import { ROUTES } from '@shared/constants/tab-url'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTodosByWorkspace } from '@entities/todo'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { useTodoList } from '@features/todo/manage-todo/model/use-todo-list'
import { useTodoKanban } from '@features/todo/manage-todo/model/use-todo-kanban'
import { DEFAULT_SORT } from '@features/todo/manage-todo/model/todo-filter'
import { TodoListView } from '@features/todo/manage-todo/ui/TodoListView'
import { TodoKanbanView } from '@features/todo/manage-todo/ui/TodoKanbanView'
import { TodoFilterBar } from '@features/todo/manage-todo/ui/TodoFilterBar'
import { CreateTodoDialog } from '@features/todo/manage-todo/ui/CreateTodoDialog'

type ViewMode = 'list' | 'kanban'

export function TodoPage(): React.JSX.Element {
  const [view, setView] = useState<ViewMode>('list') // local state (탭 닫으면 초기화)
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const { data: todos = [] } = useTodosByWorkspace(workspaceId)
  // FSD 준수: tab 열기는 pages 레이어에서만 처리
  const openTab = useTabStore((s) => s.openTab)
  const handleItemClick = (todoId: string) =>
    openTab({ type: 'todo-detail', pathname: ROUTES.TODO_DETAIL.replace(':todoId', todoId) })

  const listState = useTodoList(todos)
  const kanbanState = useTodoKanban(todos)

  const currentFilter = view === 'list' ? listState.filter : kanbanState.filter
  const currentSort = view === 'list' ? listState.sort : DEFAULT_SORT

  return (
    <TabContainer
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">할 일</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setView('list')}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'kanban' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            {workspaceId && (
              <CreateTodoDialog
                workspaceId={workspaceId}
                trigger={<Button size="sm">+ 추가</Button>}
              />
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pt-3">
        <TodoFilterBar
          filter={currentFilter}
          onFilterChange={view === 'list' ? listState.setFilter : kanbanState.setFilter}
          sort={currentSort}
          onSortChange={view === 'list' ? listState.setSort : () => {}}
          showSort={view === 'list'} // 칸반에서는 sort UI 숨김
          showStatus={view === 'list'} // 칸반에서는 status 필터 숨김 (보드 자체가 status별 분류)
        />
        {view === 'list' ? (
          <TodoListView
            todos={listState.filteredTopLevel}
            subTodoMap={listState.subTodoMap}
            workspaceId={workspaceId ?? ''}
            filterActive={listState.filterActive}
            onItemClick={handleItemClick}
          />
        ) : (
          <TodoKanbanView
            todos={todos}
            subTodoMap={kanbanState.subTodoMap}
            columnMap={kanbanState.columnMap}
            workspaceId={workspaceId ?? ''}
            filterActive={kanbanState.filterActive}
            activeColumn={kanbanState.activeColumn}
            onColumnChange={kanbanState.setActiveColumn}
            onItemClick={handleItemClick}
          />
        )}
      </div>
    </TabContainer>
  )
}
```

---

## 10. pages/todo-detail

### `src/renderer/src/pages/todo-detail/ui/TodoDetailPage.tsx`

- **props**: `tabId?: string`, `params?: { todoId: string }`
- **데이터 획득**: `useCurrentWorkspaceStore` → workspaceId → `useTodosByWorkspace(workspaceId)` → `todos.find(t => t.id === params?.todoId)`
  ```tsx
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const { data: todos = [], isLoading } = useTodosByWorkspace(workspaceId)
  const todo = todos.find((t) => t.id === params?.todoId) // undefined 가능
  // workspaceId가 null일 수 있으므로 mutations에서 non-null assertion 사용
  // workspaceId!는 todo가 존재할 때만 도달하므로 안전 (enabled: !!workspaceId 가드)
  ```
- **Loading 처리**: `isLoading`일 때 Skeleton 표시 (not-found flash 방지 — NotePage 패턴 일치)
  ```tsx
  if (isLoading) {
    return (
      <TabContainer header={<TabHeader isLoading />}>
        <div />
      </TabContainer>
    )
  }
  ```
- **Not Found 처리**: `todo`가 `undefined`인 경우 (삭제된 todo, 잘못된 URL 등) 빈 상태 표시

  ```tsx
  if (!todo) {
    return (
      <TabContainer header={<TabHeader title="할 일 상세" />}>
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          할 일을 찾을 수 없습니다
        </div>
      </TabContainer>
    )
  }
  ```

  - `import TabHeader from '@shared/ui/tab-header'` 사용 — raw `<h1>` 대신 앱 표준 헤더 컴포넌트

- **Sub-todo 목록**: `todos.filter(t => t.parentId === todo.id).sort((a,b) => a.subOrder - b.subOrder)`
  - `todoId` 변수를 별도 선언하지 않고 early return 이후 확정된 `todo.id` 사용
  ```tsx
  const subTodos = todos
    .filter((t) => t.parentId === todo.id)
    .sort((a, b) => a.subOrder - b.subOrder)
  ```
- **Sub-todo 추가**: `CreateTodoDialog` with `parentId={todo.id}` — 상세 페이지에서 직접 추가 가능
  ```tsx
  <CreateTodoDialog
    workspaceId={workspaceId!}
    parentId={todo.id}
    trigger={
      <Button variant="outline" size="sm">
        + 하위 할 일 추가
      </Button>
    }
  />
  ```

**인라인 편집 구현 패턴**:

```tsx
// title 인라인 편집 예시
const [isEditingTitle, setIsEditingTitle] = useState(false)
const [titleValue, setTitleValue] = useState(todo.title)
const updateTodo = useUpdateTodo()

{
  isEditingTitle ? (
    // TabHeader editable 스타일과 일치: text-2xl font-bold bg-transparent border-b-2
    <input
      type="text"
      value={titleValue}
      onChange={(e) => setTitleValue(e.target.value)}
      onBlur={() => {
        setIsEditingTitle(false)
        if (titleValue.trim() && titleValue.trim() !== todo.title) {
          updateTodo.mutate({
            workspaceId: workspaceId!,
            todoId: todo.id,
            data: { title: titleValue.trim() }
          })
        } else {
          setTitleValue(todo.title) // 빈 문자열이면 원래 값 복원
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur()
        if (e.key === 'Escape') {
          setTitleValue(todo.title)
          setIsEditingTitle(false)
        }
      }}
      className="text-2xl font-bold bg-transparent border-b-2 border-transparent outline-none w-full focus:border-primary transition-colors"
      autoFocus
    />
  ) : (
    <h1
      className="cursor-pointer text-2xl font-bold hover:bg-muted/50 rounded px-1"
      onClick={() => setIsEditingTitle(true)}
    >
      {todo.title}
    </h1>
  )
}
```

**각 필드 인라인 편집 방식**:

| 필드        | 편집 방식                                                         | 트리거 | 저장 시점                   |
| ----------- | ----------------------------------------------------------------- | ------ | --------------------------- |
| title       | click → `<input>` (text-2xl font-bold, TabHeader editable 스타일) | 클릭   | blur / Enter / 빈값 시 원복 |
| description | click → Textarea                                                  | 클릭   | blur                        |
| status      | Select (항상 표시)                                                | 즉시   | 선택 즉시                   |
| priority    | Select (항상 표시)                                                | 즉시   | 선택 즉시                   |
| isDone      | Checkbox                                                          | 즉시   | 클릭 즉시                   |

**필요 import 추가**:

```tsx
import TabHeader from '@shared/ui/tab-header'
// isLoading 처리 및 not-found 헤더에 사용
```

**삭제 후 탭 닫기**:

```tsx
import { useTabStore } from '@features/tap-system/manage-tab-system'

// TodoDetailPage 컴포넌트 내부:
const closeTab = useTabStore((s) => s.closeTab)

<DeleteTodoDialog
  todoId={todo.id}
  workspaceId={workspaceId!}
  hasSubTodos={subTodos.length > 0}
  trigger={<Button variant="destructive">삭제</Button>}
  onDeleted={() => { if (tabId) closeTab(tabId) }}
/>
```

### `src/renderer/src/pages/todo-detail/index.ts`

```typescript
export { TodoDetailPage } from './ui/TodoDetailPage'
```

### `src/renderer/src/pages/todo/index.ts`

`pane-routes.tsx`가 `lazy(() => import('@pages/todo'))` 형태로 import하므로 barrel export 필요:

```typescript
export { TodoPage } from './ui/TodoPage'
```

---

## 11. 라우팅

### `src/renderer/src/shared/constants/tab-url.ts` 수정

```typescript
export const ROUTES = {
  DASHBOARD: '/dashboard',
  TODO: '/todo',
  TODO_DETAIL: '/todo/:todoId', // 추가
  FOLDER: '/folder',
  SETTINGS: '/settings',
  NOTE_DETAIL: '/folder/note/:noteId',
  CALENDAR: '/calendar'
} as const
```

### `src/renderer/src/app/layout/model/pane-routes.tsx` 수정

```typescript
const TodoDetailPage = lazy(() => import('@pages/todo-detail'))

// PANE_ROUTES 배열에 추가:
{
  pattern: ROUTES.TODO_DETAIL,
  component: TodoDetailPage
}
```

---

## 12. 주요 구현 참고

### DnD order 계산

`arrayMove` 후 새 순서 배열에서 각 아이템의 새 order를 계산:

```typescript
// 드래그 완료 후 새 순서 배열을 받아 각 아이템에 1, 2, 3... 정수 할당
const updates = newOrder.map((item, i) => ({ id: item.id, order: i }))
reorderList.mutate({ workspaceId, updates })
```

> 정수 재인덱싱 방식 사용 (fractional indexing 라이브러리 불필요)

### 칸반 보드 간 이동 DnD onDragEnd 패턴

```typescript
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over) return

  const activeId = active.id as string
  const overId = over.id as string

  // over가 status string이면 보드 간 이동, todo.id이면 같은 보드 내 재정렬
  const targetStatus = KANBAN_COLUMNS.includes(overId as TodoStatus)
    ? (overId as TodoStatus)
    : todos.find((t) => t.id === overId)?.status

  const sourceTodo = todos.find((t) => t.id === activeId)
  if (!sourceTodo || !targetStatus) return

  if (sourceTodo.status !== targetStatus) {
    // 보드 간 이동: status + kanbanOrder 변경
    const targetColumn = columnMap.get(targetStatus) ?? []
    const newOrder = targetColumn.length
    reorderKanban.mutate({
      workspaceId,
      updates: [{ id: activeId, order: newOrder, status: targetStatus }]
    })
  } else {
    // 같은 보드 내 재정렬: kanbanOrder만 변경
    // overId가 status 문자열(보드 빈 공간 드롭)이면 재정렬 불필요 → early return
    if (KANBAN_COLUMNS.includes(overId as TodoStatus)) return
    const column = columnMap.get(targetStatus) ?? []
    const oldIndex = column.findIndex((t) => t.id === activeId)
    const newIndex = column.findIndex((t) => t.id === overId)
    if (oldIndex === newIndex) return
    const reordered = arrayMove(column, oldIndex, newIndex)
    reorderKanban.mutate({
      workspaceId,
      updates: reordered.map((t, i) => ({ id: t.id, order: i }))
    })
  }
}
```

### shadcn/ui priority Badge 색상 매핑

```typescript
const PRIORITY_BADGE: Record<string, string> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline'
}

<Badge variant={PRIORITY_BADGE[todo.priority] as any}>
  {todo.priority === 'high' ? '높음' : todo.priority === 'medium' ? '보통' : '낮음'}
</Badge>
```
