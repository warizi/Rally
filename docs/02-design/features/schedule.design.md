# Design: Schedule (캘린더/일정 기능)

> Plan 참조: `docs/01-plan/features/schedule.plan.md`

---

## 0. 구현 우선순위

```
[0단계] DB 스키마 + 마이그레이션
  src/main/db/schema/schedule.ts 신규
  src/main/db/schema/schedule-todo.ts 신규 (복합 PK — 프로젝트 첫 도입)
  src/main/db/schema/index.ts schedules, scheduleTodos export 추가
  npm run db:generate && npm run db:migrate

[1단계] Main Process
  repositories/schedule.ts → repositories/schedule-todo.ts
  → services/schedule.ts → ipc/schedule.ts → index.ts 등록

[2단계] Preload Bridge
  index.ts schedule 네임스페이스 추가
  index.d.ts ScheduleItem, ScheduleAPI 등 타입 추가

[3단계] entities/schedule (React Query)
  types.ts → queries.ts (9개 hooks) → index.ts

[4단계] 유틸 + 모델
  calendar-utils.ts (날짜 계산 유틸)
  use-calendar.ts (캘린더 상태 관리 훅)
  schedule-color.ts (색상 프리셋 + priority 기본 색상)

[5단계] 공통 UI 컴포넌트
  CalendarNavigation → ScheduleFormDialog → DeleteScheduleDialog
  → ScheduleDetailPopover → ColorPicker → LinkedTodoList → TodoLinkPopover
  → CurrentTimeIndicator → TimeGrid → ScheduleBlock → ScheduleBar
  → ScheduleDot → MonthDayCell

[6단계] 월간 뷰
  MonthView (DndContext + 그리드 + 바 렌더링 + 반응형)

[7단계] 주간 뷰
  WeekView (DndContext + TimeGrid + 7열/1열 반응형)

[8단계] 일간 뷰
  DayView (DndContext + TimeGrid + 겹침 레이아웃)

[9단계] widgets + pages + 라우팅
  CalendarViewToolbar → CalendarPage → pane-routes.tsx 추가

[10단계] Todo 연결
  LinkedTodoList + TodoLinkPopover 실제 동작 통합
```

---

## 1. DB Schema

### `src/main/db/schema/schedule.ts`

```typescript
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { workspaces } from './workspace'

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
  startAt: integer('start_at', { mode: 'timestamp_ms' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp_ms' }).notNull(),
  color: text('color'),
  priority: text('priority', { enum: ['low', 'medium', 'high'] })
    .notNull()
    .default('medium'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})
```

> **workspaceId nullable**: `workspaces.id` cascade FK이지만 null 허용 (전역 일정). 기존 todos는 `notNull()`이지만 schedule은 null 가능한 점이 차이.

### `src/main/db/schema/schedule-todo.ts`

```typescript
import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { schedules } from './schedule'
import { todos } from './todo'

export const scheduleTodos = sqliteTable(
  'schedule_todos',
  {
    scheduleId: text('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    todoId: text('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.scheduleId, t.todoId] })]
)
```

> **프로젝트 첫 복합 PK**: `primaryKey()` 함수는 `drizzle-orm/sqlite-core`에서 export. 기존 모든 테이블은 단일 text PK 사용.

### `src/main/db/schema/index.ts` 변경

```typescript
// 기존 exports에 추가
export { schedules } from './schedule'
export { scheduleTodos } from './schedule-todo'
```

### 비즈니스 규칙

| 규칙                                                       | 검증 위치           | 에러            |
| ---------------------------------------------------------- | ------------------- | --------------- |
| `startAt <= endAt`                                         | service             | ValidationError |
| `title.trim()` 빈 문자열                                   | service             | ValidationError |
| workspace 존재 (workspaceId 있을 때)                       | service             | NotFoundError   |
| `allDay = true` → startAt 00:00:00.000, endAt 23:59:59.999 | service (자동 보정) | —               |
| 여러 날 일정 허용                                          | —                   | —               |
| `color` null → priority별 기본 색상                        | renderer            | —               |
| DnD move: duration 유지                                    | renderer + service  | —               |
| Todo 연결 N:M                                              | DB schema (복합 PK) | —               |

---

## 2. Repository Layer

### `src/main/repositories/schedule.ts`

```typescript
import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '../db'
import { schedules } from '../db/schema'

export type Schedule = typeof schedules.$inferSelect
export type ScheduleInsert = typeof schedules.$inferInsert

export const scheduleRepository = {
  findByWorkspaceId(workspaceId: string, rangeStart: number, rangeEnd: number): Schedule[] {
    // WHERE workspaceId = ? AND startAt <= rangeEnd AND endAt >= rangeStart
    return db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.workspaceId, workspaceId),
          lte(schedules.startAt, new Date(rangeEnd)),
          gte(schedules.endAt, new Date(rangeStart))
        )
      )
      .orderBy(schedules.startAt)
      .all()
  },

  findById(id: string): Schedule | undefined {
    return db.select().from(schedules).where(eq(schedules.id, id)).get()
  },

  create(data: ScheduleInsert): Schedule {
    return db.insert(schedules).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<
      Pick<
        Schedule,
        | 'title'
        | 'description'
        | 'location'
        | 'allDay'
        | 'startAt'
        | 'endAt'
        | 'color'
        | 'priority'
        | 'updatedAt'
      >
    >
  ): Schedule | undefined {
    return db.update(schedules).set(data).where(eq(schedules.id, id)).returning().get()
  },

  delete(id: string): void {
    db.delete(schedules).where(eq(schedules.id, id)).run()
  }
}
```

### `src/main/repositories/schedule-todo.ts`

```typescript
import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { scheduleTodos } from '../db/schema'
import { todos } from '../db/schema'

export type ScheduleTodo = typeof scheduleTodos.$inferSelect

export const scheduleTodoRepository = {
  findByScheduleId(scheduleId: string): ScheduleTodo[] {
    return db.select().from(scheduleTodos).where(eq(scheduleTodos.scheduleId, scheduleId)).all()
  },

  findTodosByScheduleId(scheduleId: string) {
    return db
      .select({ todo: todos })
      .from(scheduleTodos)
      .innerJoin(todos, eq(scheduleTodos.todoId, todos.id))
      .where(eq(scheduleTodos.scheduleId, scheduleId))
      .all()
      .map((row) => row.todo)
  },

  link(scheduleId: string, todoId: string): void {
    // INSERT OR IGNORE — 멱등성
    db.insert(scheduleTodos).values({ scheduleId, todoId }).onConflictDoNothing().run()
  },

  unlink(scheduleId: string, todoId: string): void {
    db.delete(scheduleTodos)
      .where(and(eq(scheduleTodos.scheduleId, scheduleId), eq(scheduleTodos.todoId, todoId)))
      .run()
  }
}
```

---

## 3. Service Layer

### `src/main/services/schedule.ts`

```typescript
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { scheduleRepository } from '../repositories/schedule'
import { scheduleTodoRepository } from '../repositories/schedule-todo'
import { workspaceRepository } from '../repositories/workspace'
import { todoRepository } from '../repositories/todo'
import type { Schedule } from '../repositories/schedule'
import type { Todo } from '../repositories/todo'

// === Domain Types ===

export interface ScheduleItem {
  id: string
  workspaceId: string | null
  title: string
  description: string | null
  location: string | null
  allDay: boolean
  startAt: Date
  endAt: Date
  color: string | null
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
  updatedAt: Date
}

export interface CreateScheduleData {
  title: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt: Date
  endAt: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

export interface UpdateScheduleData {
  title?: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt?: Date
  endAt?: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

export interface ScheduleDateRange {
  start: Date
  end: Date
}

// === Mapper ===

function toScheduleItem(row: Schedule): ScheduleItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    location: row.location,
    allDay: row.allDay,
    startAt: new Date(row.startAt as unknown as number),
    endAt: new Date(row.endAt as unknown as number),
    color: row.color,
    priority: row.priority,
    createdAt: new Date(row.createdAt as unknown as number),
    updatedAt: new Date(row.updatedAt as unknown as number)
  }
}

// === Service ===

export const scheduleService = {
  findByWorkspace(workspaceId: string, range: ScheduleDateRange): ScheduleItem[] {
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError('워크스페이스를 찾을 수 없습니다')

    const rows = scheduleRepository.findByWorkspaceId(
      workspaceId,
      range.start.getTime(),
      range.end.getTime()
    )
    return rows.map(toScheduleItem)
  },

  findById(scheduleId: string): ScheduleItem {
    const row = scheduleRepository.findById(scheduleId)
    if (!row) throw new NotFoundError('일정을 찾을 수 없습니다')
    return toScheduleItem(row)
  },

  create(workspaceId: string, data: CreateScheduleData): ScheduleItem {
    // workspace 존재 확인
    const workspace = workspaceRepository.findById(workspaceId)
    if (!workspace) throw new NotFoundError('워크스페이스를 찾을 수 없습니다')

    // 제목 검증
    if (!data.title.trim()) throw new ValidationError('제목을 입력해주세요')

    // 시간 검증
    if (data.startAt > data.endAt) {
      throw new ValidationError('시작 시간이 종료 시간보다 늦을 수 없습니다')
    }

    const now = new Date()
    let startAt = data.startAt
    let endAt = data.endAt

    // allDay 보정
    if (data.allDay) {
      startAt = new Date(startAt.getFullYear(), startAt.getMonth(), startAt.getDate(), 0, 0, 0, 0)
      endAt = new Date(endAt.getFullYear(), endAt.getMonth(), endAt.getDate(), 23, 59, 59, 999)
    }

    const row = scheduleRepository.create({
      id: nanoid(),
      workspaceId,
      title: data.title.trim(),
      description: data.description ?? null,
      location: data.location ?? null,
      allDay: data.allDay ?? false,
      startAt,
      endAt,
      color: data.color ?? null,
      priority: data.priority ?? 'medium',
      createdAt: now,
      updatedAt: now
    })

    return toScheduleItem(row)
  },

  update(scheduleId: string, data: UpdateScheduleData): ScheduleItem {
    const existing = scheduleRepository.findById(scheduleId)
    if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')

    // startAt/endAt 변경 시 기존값과 merge 후 재검증
    const startAt = data.startAt ?? new Date(existing.startAt as unknown as number)
    const endAt = data.endAt ?? new Date(existing.endAt as unknown as number)

    if (startAt > endAt) {
      throw new ValidationError('시작 시간이 종료 시간보다 늦을 수 없습니다')
    }

    const allDay = data.allDay ?? existing.allDay
    let finalStartAt = data.startAt ?? undefined
    let finalEndAt = data.endAt ?? undefined

    // allDay 변경 시 시간 자동 보정
    if (allDay && data.allDay !== undefined) {
      finalStartAt = new Date(
        startAt.getFullYear(),
        startAt.getMonth(),
        startAt.getDate(),
        0,
        0,
        0,
        0
      )
      finalEndAt = new Date(endAt.getFullYear(), endAt.getMonth(), endAt.getDate(), 23, 59, 59, 999)
    }

    const row = scheduleRepository.update(scheduleId, {
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.allDay !== undefined && { allDay }),
      ...(finalStartAt && { startAt: finalStartAt }),
      ...(finalEndAt && { endAt: finalEndAt }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.priority !== undefined && { priority: data.priority }),
      updatedAt: new Date()
    })

    if (!row) throw new NotFoundError('일정을 찾을 수 없습니다')
    return toScheduleItem(row)
  },

  remove(scheduleId: string): void {
    const existing = scheduleRepository.findById(scheduleId)
    if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')
    scheduleRepository.delete(scheduleId) // schedule_todos cascade 삭제
  },

  move(scheduleId: string, startAt: Date, endAt: Date): ScheduleItem {
    const existing = scheduleRepository.findById(scheduleId)
    if (!existing) throw new NotFoundError('일정을 찾을 수 없습니다')

    if (startAt > endAt) {
      throw new ValidationError('시작 시간이 종료 시간보다 늦을 수 없습니다')
    }

    const row = scheduleRepository.update(scheduleId, {
      startAt,
      endAt,
      updatedAt: new Date()
    })

    if (!row) throw new NotFoundError('일정을 찾을 수 없습니다')
    return toScheduleItem(row)
  },

  linkTodo(scheduleId: string, todoId: string): void {
    const schedule = scheduleRepository.findById(scheduleId)
    if (!schedule) throw new NotFoundError('일정을 찾을 수 없습니다')

    const todo = todoRepository.findById(todoId)
    if (!todo) throw new NotFoundError('할 일을 찾을 수 없습니다')

    scheduleTodoRepository.link(scheduleId, todoId) // INSERT OR IGNORE
  },

  unlinkTodo(scheduleId: string, todoId: string): void {
    scheduleTodoRepository.unlink(scheduleId, todoId) // 멱등성
  },

  getLinkedTodos(scheduleId: string): TodoItem[] {
    const schedule = scheduleRepository.findById(scheduleId)
    if (!schedule) throw new NotFoundError('일정을 찾을 수 없습니다')

    const todoRows = scheduleTodoRepository.findTodosByScheduleId(scheduleId)
    return todoRows.map(toTodoItem)
  }
}

// schedule 전용 todoItem mapper (todoService의 toTodoItem이 private이므로 별도 정의)
// todoService.ts의 toTodoItem과 동일 로직
function toTodoItem(todo: Todo): TodoItem {
  return {
    id: todo.id,
    workspaceId: todo.workspaceId,
    parentId: todo.parentId,
    title: todo.title,
    description: todo.description,
    status: todo.status,
    priority: todo.priority,
    isDone: todo.isDone,
    listOrder: todo.listOrder,
    kanbanOrder: todo.kanbanOrder,
    subOrder: todo.subOrder,
    createdAt: new Date(todo.createdAt as unknown as number),
    updatedAt: new Date(todo.updatedAt as unknown as number),
    doneAt: todo.doneAt ? new Date(todo.doneAt as unknown as number) : null,
    dueDate: todo.dueDate ? new Date(todo.dueDate as unknown as number) : null,
    startDate: todo.startDate ? new Date(todo.startDate as unknown as number) : null
  }
}
```

> **`toTodoItem` 별도 정의**: `todoService.ts`의 `toTodoItem`은 private 함수이므로 import 불가. schedule 서비스에 동일 로직의 private mapper를 별도 정의한다.

---

## 4. IPC Layer

### `src/main/ipc/schedule.ts`

```typescript
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { handle } from '../lib/handle'
import { scheduleService } from '../services/schedule'
import type {
  CreateScheduleData,
  UpdateScheduleData,
  ScheduleDateRange
} from '../services/schedule'

export function registerScheduleHandlers(): void {
  ipcMain.handle(
    'schedule:findByWorkspace',
    (_: IpcMainInvokeEvent, workspaceId: string, range: ScheduleDateRange) =>
      handle(() => scheduleService.findByWorkspace(workspaceId, range))
  )

  ipcMain.handle('schedule:findById', (_: IpcMainInvokeEvent, scheduleId: string) =>
    handle(() => scheduleService.findById(scheduleId))
  )

  ipcMain.handle(
    'schedule:create',
    (_: IpcMainInvokeEvent, workspaceId: string, data: CreateScheduleData) =>
      handle(() => scheduleService.create(workspaceId, data))
  )

  ipcMain.handle(
    'schedule:update',
    (_: IpcMainInvokeEvent, scheduleId: string, data: UpdateScheduleData) =>
      handle(() => scheduleService.update(scheduleId, data))
  )

  ipcMain.handle('schedule:remove', (_: IpcMainInvokeEvent, scheduleId: string) =>
    handle(() => scheduleService.remove(scheduleId))
  )

  ipcMain.handle(
    'schedule:move',
    (_: IpcMainInvokeEvent, scheduleId: string, startAt: Date, endAt: Date) =>
      handle(() => scheduleService.move(scheduleId, startAt, endAt))
  )

  ipcMain.handle('schedule:linkTodo', (_: IpcMainInvokeEvent, scheduleId: string, todoId: string) =>
    handle(() => scheduleService.linkTodo(scheduleId, todoId))
  )

  ipcMain.handle(
    'schedule:unlinkTodo',
    (_: IpcMainInvokeEvent, scheduleId: string, todoId: string) =>
      handle(() => scheduleService.unlinkTodo(scheduleId, todoId))
  )

  ipcMain.handle('schedule:getLinkedTodos', (_: IpcMainInvokeEvent, scheduleId: string) =>
    handle(() => scheduleService.getLinkedTodos(scheduleId))
  )
}
```

### `src/main/index.ts` 변경

```typescript
// 기존 import에 추가
import { registerScheduleHandlers } from './ipc/schedule'

// app.whenReady().then() 내에 추가
registerScheduleHandlers()
```

---

## 5. Preload Bridge

### `src/preload/index.ts` 변경

```typescript
// api 객체에 schedule 네임스페이스 추가
schedule: {
  findByWorkspace: (workspaceId: string, range: unknown) =>
    ipcRenderer.invoke('schedule:findByWorkspace', workspaceId, range),
  findById: (scheduleId: string) =>
    ipcRenderer.invoke('schedule:findById', scheduleId),
  create: (workspaceId: string, data: unknown) =>
    ipcRenderer.invoke('schedule:create', workspaceId, data),
  update: (scheduleId: string, data: unknown) =>
    ipcRenderer.invoke('schedule:update', scheduleId, data),
  remove: (scheduleId: string) =>
    ipcRenderer.invoke('schedule:remove', scheduleId),
  move: (scheduleId: string, startAt: unknown, endAt: unknown) =>
    ipcRenderer.invoke('schedule:move', scheduleId, startAt, endAt),
  linkTodo: (scheduleId: string, todoId: string) =>
    ipcRenderer.invoke('schedule:linkTodo', scheduleId, todoId),
  unlinkTodo: (scheduleId: string, todoId: string) =>
    ipcRenderer.invoke('schedule:unlinkTodo', scheduleId, todoId),
  getLinkedTodos: (scheduleId: string) =>
    ipcRenderer.invoke('schedule:getLinkedTodos', scheduleId),
},
```

### `src/preload/index.d.ts` 변경

```typescript
// 타입 추가
interface ScheduleItem {
  id: string
  workspaceId: string | null
  title: string
  description: string | null
  location: string | null
  allDay: boolean
  startAt: Date
  endAt: Date
  color: string | null
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
  updatedAt: Date
}

interface CreateScheduleData {
  title: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt: Date
  endAt: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

interface UpdateScheduleData {
  title?: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt?: Date
  endAt?: Date
  color?: string | null
  priority?: 'low' | 'medium' | 'high'
}

interface ScheduleDateRange {
  start: Date
  end: Date
}

interface ScheduleAPI {
  findByWorkspace: (
    workspaceId: string,
    range: ScheduleDateRange
  ) => Promise<IpcResponse<ScheduleItem[]>>
  findById: (scheduleId: string) => Promise<IpcResponse<ScheduleItem>>
  create: (workspaceId: string, data: CreateScheduleData) => Promise<IpcResponse<ScheduleItem>>
  update: (scheduleId: string, data: UpdateScheduleData) => Promise<IpcResponse<ScheduleItem>>
  remove: (scheduleId: string) => Promise<IpcResponse<void>>
  move: (scheduleId: string, startAt: Date, endAt: Date) => Promise<IpcResponse<ScheduleItem>>
  linkTodo: (scheduleId: string, todoId: string) => Promise<IpcResponse<void>>
  unlinkTodo: (scheduleId: string, todoId: string) => Promise<IpcResponse<void>>
  getLinkedTodos: (scheduleId: string) => Promise<IpcResponse<TodoItem[]>>
}

// API 인터페이스에 추가
interface API {
  // ... 기존
  schedule: ScheduleAPI
}
```

---

## 6. Renderer — entities/schedule

### 파일 구조

```
src/renderer/src/entities/schedule/
├── model/
│   ├── types.ts
│   └── queries.ts
└── index.ts
```

### `model/types.ts`

```typescript
export type SchedulePriority = 'low' | 'medium' | 'high'

export interface ScheduleItem {
  id: string
  workspaceId: string | null
  title: string
  description: string | null
  location: string | null
  allDay: boolean
  startAt: Date
  endAt: Date
  color: string | null
  priority: SchedulePriority
  createdAt: Date
  updatedAt: Date
}

export interface CreateScheduleData {
  title: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt: Date
  endAt: Date
  color?: string | null
  priority?: SchedulePriority
}

export interface UpdateScheduleData {
  title?: string
  description?: string | null
  location?: string | null
  allDay?: boolean
  startAt?: Date
  endAt?: Date
  color?: string | null
  priority?: SchedulePriority
}

export interface ScheduleDateRange {
  start: Date
  end: Date
}
```

### `model/queries.ts`

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
import type {
  ScheduleItem,
  CreateScheduleData,
  UpdateScheduleData,
  ScheduleDateRange
} from './types'
import type { TodoItem } from '@entities/todo'

const SCHEDULE_KEY = 'schedule'

// --- Queries ---

export function useSchedulesByWorkspace(
  workspaceId: string | null | undefined,
  range: ScheduleDateRange
): UseQueryResult<ScheduleItem[]> {
  return useQuery({
    queryKey: [
      SCHEDULE_KEY,
      'workspace',
      workspaceId,
      range.start.toISOString(),
      range.end.toISOString()
    ],
    queryFn: async (): Promise<ScheduleItem[]> => {
      const res: IpcResponse<ScheduleItem[]> = await window.api.schedule.findByWorkspace(
        workspaceId!,
        range
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId
  })
}

export function useScheduleById(scheduleId: string | undefined): UseQueryResult<ScheduleItem> {
  return useQuery({
    queryKey: [SCHEDULE_KEY, 'detail', scheduleId],
    queryFn: async (): Promise<ScheduleItem> => {
      const res: IpcResponse<ScheduleItem> = await window.api.schedule.findById(scheduleId!)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    enabled: !!scheduleId
  })
}

export function useLinkedTodos(scheduleId: string | undefined): UseQueryResult<TodoItem[]> {
  return useQuery({
    queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId],
    queryFn: async () => {
      const res = await window.api.schedule.getLinkedTodos(scheduleId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!scheduleId
  })
}

// --- Mutations ---

export function useCreateSchedule(): UseMutationResult<
  ScheduleItem,
  Error,
  { workspaceId: string; data: CreateScheduleData }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, data }) => {
      const res = await window.api.schedule.create(workspaceId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'workspace', workspaceId]
      })
    }
  })
}

export function useUpdateSchedule(): UseMutationResult<
  ScheduleItem,
  Error,
  { scheduleId: string; data: UpdateScheduleData; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, data }) => {
      const res = await window.api.schedule.update(scheduleId, data)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'workspace', workspaceId]
      })
    }
  })
}

export function useRemoveSchedule(): UseMutationResult<
  void,
  Error,
  { scheduleId: string; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId }) => {
      const res = await window.api.schedule.remove(scheduleId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'workspace', workspaceId]
      })
    }
  })
}

export function useMoveSchedule(): UseMutationResult<
  ScheduleItem,
  Error,
  { scheduleId: string; startAt: Date; endAt: Date; workspaceId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, startAt, endAt }) => {
      const res = await window.api.schedule.move(scheduleId, startAt, endAt)
      if (!res.success) throwIpcError(res)
      return res.data!
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'workspace', workspaceId]
      })
    }
  })
}

export function useLinkTodo(): UseMutationResult<
  void,
  Error,
  { scheduleId: string; todoId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, todoId }) => {
      const res = await window.api.schedule.linkTodo(scheduleId, todoId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId]
      })
    }
  })
}

export function useUnlinkTodo(): UseMutationResult<
  void,
  Error,
  { scheduleId: string; todoId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scheduleId, todoId }) => {
      const res = await window.api.schedule.unlinkTodo(scheduleId, todoId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { scheduleId }) => {
      queryClient.invalidateQueries({
        queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId]
      })
    }
  })
}
```

### `index.ts`

```typescript
export type {
  ScheduleItem,
  CreateScheduleData,
  UpdateScheduleData,
  ScheduleDateRange,
  SchedulePriority
} from './model/types'
export {
  useSchedulesByWorkspace,
  useScheduleById,
  useLinkedTodos,
  useCreateSchedule,
  useUpdateSchedule,
  useRemoveSchedule,
  useMoveSchedule,
  useLinkTodo,
  useUnlinkTodo
} from './model/queries'
```

---

## 7. Renderer — features/schedule 유틸 + 모델

### 파일 구조

```
src/renderer/src/features/schedule/manage-schedule/
├── model/
│   ├── calendar-utils.ts
│   ├── use-calendar.ts
│   └── schedule-color.ts
├── ui/
│   ├── CalendarNavigation.tsx
│   ├── MonthView.tsx
│   ├── WeekView.tsx
│   ├── DayView.tsx
│   ├── MonthDayCell.tsx
│   ├── TimeGrid.tsx
│   ├── ScheduleBlock.tsx
│   ├── ScheduleBar.tsx
│   ├── ScheduleDot.tsx
│   ├── ScheduleFormDialog.tsx
│   ├── DeleteScheduleDialog.tsx
│   ├── ScheduleDetailPopover.tsx
│   ├── LinkedTodoList.tsx
│   ├── TodoLinkPopover.tsx
│   ├── CurrentTimeIndicator.tsx
│   └── ColorPicker.tsx
└── index.ts
```

### `model/schedule-color.ts`

```typescript
import type { ScheduleItem } from '@entities/schedule'

export const SCHEDULE_COLOR_PRESETS = [
  { label: '기본', value: null },
  { label: '빨강', value: '#ef4444' },
  { label: '주황', value: '#f97316' },
  { label: '노랑', value: '#eab308' },
  { label: '초록', value: '#22c55e' },
  { label: '파랑', value: '#3b82f6' },
  { label: '보라', value: '#a855f7' },
  { label: '분홍', value: '#ec4899' }
] as const

export const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#3b82f6',
  low: '#6b7280'
}

export function getScheduleColor(schedule: ScheduleItem): string {
  return schedule.color ?? PRIORITY_COLORS[schedule.priority]
}
```

### `model/calendar-utils.ts`

> **date-fns 신규 import**: `addDays`, `addWeeks`, `addMonths`, `subDays`, `subWeeks`, `subMonths`, `startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`, `startOfDay`, `endOfDay`, `getDay`, `getDaysInMonth`, `isSameDay`, `isSameMonth`, `isWithinInterval`, `differenceInMinutes`, `differenceInDays`, `format`. 현재 프로젝트에서는 `format`만 사용 중.

```typescript
import {
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  isSameDay,
  isSameMonth,
  differenceInMinutes,
  differenceInDays,
  getDay
} from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'

// === 타입 ===

export interface MonthGridDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
}

export interface TimeSlot {
  hour: number
  label: string
}

export interface ScheduleBarLayout {
  startCol: number // 0~6 (일~토)
  span: number // 차지하는 열 수 (1~7)
}

export interface LayoutedSchedule {
  schedule: ScheduleItem
  column: number // 0-based 수평 위치
  totalColumns: number // 동시 겹침 최대 수
}

export interface WeekBarSegment {
  weekIndex: number // 몇 번째 주 row인지
  startCol: number // 해당 주 내 시작 열 (0~6)
  span: number // 해당 주 내 차지하는 열 수
  isStart: boolean // 이 세그먼트가 일정의 진짜 시작인지
  isEnd: boolean // 이 세그먼트가 일정의 진짜 끝인지
}

// === 월간 그리드 ===

/** 월간 그리드 (5~6주 x 7일 = 35~42개 날짜) */
export function getMonthGrid(year: number, month: number): MonthGridDay[][] {
  const today = startOfDay(new Date())
  const firstDay = new Date(year, month, 1)
  const monthStart = startOfWeek(startOfMonth(firstDay))
  const monthEnd = endOfWeek(endOfMonth(firstDay))

  const weeks: MonthGridDay[][] = []
  let current = monthStart

  while (current <= monthEnd) {
    const week: MonthGridDay[] = []
    for (let i = 0; i < 7; i++) {
      week.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        isToday: isSameDay(current, today)
      })
      current = addDays(current, 1)
    }
    weeks.push(week)
  }

  return weeks
}

// === 주간 ===

/** 주간 날짜 배열 (일~토 7일) */
export function getWeekDates(date: Date): Date[] {
  const weekStart = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

// === 시간 ===

/** 시간 슬롯 (00~23시) */
export function getTimeSlots(): TimeSlot[] {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${String(i).padStart(2, '0')}:00`
  }))
}

/** 시간 → 픽셀 위치 */
export function timeToPosition(date: Date, hourHeight: number): number {
  return (date.getHours() + date.getMinutes() / 60) * hourHeight
}

/** 일정 높이 계산 */
export function scheduleHeight(startAt: Date, endAt: Date, hourHeight: number): number {
  return Math.max((differenceInMinutes(endAt, startAt) / 60) * hourHeight, 20)
}

// === 날짜 비교 ===

/** 일정이 특정 날짜에 해당하는지 (여러 날 포함) */
export function isScheduleOnDate(schedule: ScheduleItem, date: Date): boolean {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  return schedule.startAt <= dayEnd && schedule.endAt >= dayStart
}

// === 월간 바 레이아웃 ===

/** 월간 뷰: 일정의 주(row) 내 가로 배치 계산 */
export function getScheduleBarLayout(
  schedule: ScheduleItem,
  weekStart: Date,
  weekEnd: Date
): ScheduleBarLayout | null {
  if (schedule.startAt > weekEnd || schedule.endAt < weekStart) return null

  const effectiveStart = schedule.startAt < weekStart ? weekStart : schedule.startAt
  const effectiveEnd = schedule.endAt > weekEnd ? weekEnd : schedule.endAt

  const startCol = getDay(effectiveStart)
  const endCol = getDay(effectiveEnd)
  const span = endCol - startCol + 1

  return { startCol, span }
}

/** 월간 뷰: 여러 날 일정 바의 주(row)별 분할 */
export function splitBarByWeeks(
  schedule: ScheduleItem,
  monthGrid: MonthGridDay[][]
): WeekBarSegment[] {
  const segments: WeekBarSegment[] = []

  for (let weekIdx = 0; weekIdx < monthGrid.length; weekIdx++) {
    const week = monthGrid[weekIdx]
    const weekStart = startOfDay(week[0].date)
    const weekEnd = endOfDay(week[6].date)

    if (schedule.startAt > weekEnd || schedule.endAt < weekStart) continue

    const effectiveStart = schedule.startAt < weekStart ? weekStart : schedule.startAt
    const effectiveEnd = schedule.endAt > weekEnd ? weekEnd : schedule.endAt

    segments.push({
      weekIndex: weekIdx,
      startCol: getDay(effectiveStart),
      span: differenceInDays(startOfDay(effectiveEnd), startOfDay(effectiveStart)) + 1,
      isStart: isSameDay(effectiveStart, schedule.startAt),
      isEnd: isSameDay(effectiveEnd, schedule.endAt)
    })
  }

  return segments
}

// === 겹침 레이아웃 (일간/주간) ===

/** 겹치는 일정 수평 분할 레이아웃 */
export function layoutOverlappingSchedules(schedules: ScheduleItem[]): LayoutedSchedule[] {
  if (schedules.length === 0) return []

  // startAt ASC 정렬
  const sorted = [...schedules].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())

  const result: LayoutedSchedule[] = []
  const clusters: { items: { schedule: ScheduleItem; column: number }[]; maxEnd: Date }[] = []

  for (const schedule of sorted) {
    // 기존 cluster에 속하는지 확인
    let placed = false
    for (const cluster of clusters) {
      if (schedule.startAt < cluster.maxEnd) {
        // 겹침 → 이 cluster에 추가
        const usedColumns = new Set(cluster.items.map((i) => i.column))
        let col = 0
        while (usedColumns.has(col)) col++
        cluster.items.push({ schedule, column: col })
        if (schedule.endAt > cluster.maxEnd) cluster.maxEnd = schedule.endAt
        placed = true
        break
      }
    }

    if (!placed) {
      clusters.push({
        items: [{ schedule, column: 0 }],
        maxEnd: schedule.endAt
      })
    }
  }

  // cluster 내 totalColumns 계산
  for (const cluster of clusters) {
    const totalColumns = Math.max(...cluster.items.map((i) => i.column)) + 1
    for (const item of cluster.items) {
      result.push({
        schedule: item.schedule,
        column: item.column,
        totalColumns
      })
    }
  }

  return result
}

// === DnD 유틸 ===

/** DnD: 날짜 이동 (duration 유지) */
export function moveScheduleByDays(
  schedule: ScheduleItem,
  daysDelta: number
): { startAt: Date; endAt: Date } {
  return {
    startAt: addDays(schedule.startAt, daysDelta),
    endAt: addDays(schedule.endAt, daysDelta)
  }
}

/** DnD: 분 단위 이동 (15분 스냅) */
export function moveScheduleByMinutes(
  schedule: ScheduleItem,
  minutesDelta: number
): { startAt: Date; endAt: Date } {
  const snapped = Math.round(minutesDelta / 15) * 15
  const msOffset = snapped * 60 * 1000
  return {
    startAt: new Date(schedule.startAt.getTime() + msOffset),
    endAt: new Date(schedule.endAt.getTime() + msOffset)
  }
}
```

### `model/use-calendar.ts`

```typescript
import { useState, useMemo } from 'react'
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  format
} from 'date-fns'
import { ko } from 'date-fns/locale'
import type { ScheduleDateRange } from '@entities/schedule'

export type CalendarViewType = 'month' | 'week' | 'day'

interface UseCalendarOptions {
  initialViewType?: CalendarViewType
  initialDate?: string // ISO string (tabSearchParams에서 복원)
}

interface UseCalendarReturn {
  currentDate: Date
  selectedDate: Date | null
  viewType: CalendarViewType
  setViewType: (type: CalendarViewType) => void
  selectDate: (date: Date) => void
  goToday: () => void
  goPrev: () => void
  goNext: () => void
  title: string
  dateRange: ScheduleDateRange
}

export function useCalendar(options?: UseCalendarOptions): UseCalendarReturn {
  const [viewType, setViewType] = useState<CalendarViewType>(options?.initialViewType ?? 'month')
  const [currentDate, setCurrentDate] = useState<Date>(
    options?.initialDate ? new Date(options.initialDate) : new Date()
  )
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  function selectDate(date: Date): void {
    setSelectedDate(date)
    setCurrentDate(date)
  }

  function goToday(): void {
    setCurrentDate(new Date())
    setSelectedDate(null)
  }

  function goPrev(): void {
    setCurrentDate((prev) => {
      if (viewType === 'month') return subMonths(prev, 1)
      if (viewType === 'week') return subWeeks(prev, 1)
      return subDays(prev, 1)
    })
  }

  function goNext(): void {
    setCurrentDate((prev) => {
      if (viewType === 'month') return addMonths(prev, 1)
      if (viewType === 'week') return addWeeks(prev, 1)
      return addDays(prev, 1)
    })
  }

  const title = useMemo(() => {
    if (viewType === 'month') {
      return format(currentDate, 'yyyy년 M월', { locale: ko })
    }
    if (viewType === 'week') {
      const weekStart = startOfWeek(currentDate)
      const weekEnd = endOfWeek(currentDate)
      return `${format(weekStart, 'yyyy년 M월 d일', { locale: ko })} ~ ${format(weekEnd, 'M월 d일', { locale: ko })}`
    }
    return format(currentDate, 'yyyy년 M월 d일 (eee)', { locale: ko })
  }, [currentDate, viewType])

  const dateRange: ScheduleDateRange = useMemo(() => {
    if (viewType === 'month') {
      // monthGrid 범위 포함 (앞뒤 주 padding)
      const monthStart = startOfWeek(startOfMonth(currentDate))
      const monthEnd = endOfWeek(endOfMonth(currentDate))
      return { start: monthStart, end: monthEnd }
    }
    if (viewType === 'week') {
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) }
    }
    return { start: startOfDay(currentDate), end: endOfDay(currentDate) }
  }, [currentDate, viewType])

  return {
    currentDate,
    selectedDate,
    viewType,
    setViewType,
    selectDate,
    goToday,
    goPrev,
    goNext,
    title,
    dateRange
  }
}
```

---

## 8. Renderer — UI 컴포넌트 상세

### CalendarPage (`pages/calendar/ui/CalendarPage.tsx`)

```typescript
import { addDays, addMonths, addWeeks, subDays, subMonths, subWeeks } from 'date-fns'
import { useCurrentWorkspaceStore } from '@entities/workspace'
import { useTabStore } from '@entities/tab-system'
import { useSchedulesByWorkspace } from '@entities/schedule'
import { TabContainer } from '@shared/ui/tab-container'
import { TabHeader } from '@shared/ui/tab-header'
import { CalendarViewToolbar } from '@widgets/calendar'
import {
  CalendarNavigation, MonthView, WeekView, DayView,
} from '@features/schedule/manage-schedule'
import { useCalendar, type CalendarViewType } from '@features/schedule/manage-schedule'

interface Props {
  tabId?: string
}

export function CalendarPage({ tabId }: Props): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const tabSearchParams = useTabStore((s) =>
    tabId ? s.tabs[tabId]?.searchParams : undefined
  )
  const navigateTab = useTabStore((s) => s.navigateTab)

  const calendar = useCalendar({
    initialViewType: (tabSearchParams?.viewType as CalendarViewType) || 'month',
    initialDate: tabSearchParams?.currentDate,
  })

  const { data: schedules = [] } = useSchedulesByWorkspace(
    workspaceId,
    calendar.dateRange
  )

  // tabSearchParams 동기화 핸들러
  function handleViewTypeChange(type: CalendarViewType): void {
    calendar.setViewType(type)
    if (tabId) {
      navigateTab(tabId, {
        searchParams: { ...tabSearchParams, viewType: type },
      })
    }
  }

  function syncCurrentDate(date: Date): void {
    if (tabId) {
      navigateTab(tabId, {
        searchParams: { ...tabSearchParams, currentDate: date.toISOString() },
      })
    }
  }

  // 주의: goPrev/goNext는 setState이므로 호출 직후 calendar.currentDate는 이전 값.
  // 새 날짜를 직접 계산하여 syncCurrentDate에 전달해야 함.
  function handlePrev(): void {
    const newDate = calendar.viewType === 'month'
      ? subMonths(calendar.currentDate, 1)
      : calendar.viewType === 'week'
        ? subWeeks(calendar.currentDate, 1)
        : subDays(calendar.currentDate, 1)
    calendar.goPrev()
    syncCurrentDate(newDate)
  }

  function handleNext(): void {
    const newDate = calendar.viewType === 'month'
      ? addMonths(calendar.currentDate, 1)
      : calendar.viewType === 'week'
        ? addWeeks(calendar.currentDate, 1)
        : addDays(calendar.currentDate, 1)
    calendar.goNext()
    syncCurrentDate(newDate)
  }

  function handleToday(): void {
    calendar.goToday()
    syncCurrentDate(new Date())
  }

  function handleSelectDate(date: Date): void {
    calendar.selectDate(date)
    syncCurrentDate(date)
  }

  return (
    <TabContainer
      scrollable={false}
      header={
        <TabHeader
          title="캘린더"
          description="일정을 관리하는 캘린더 페이지입니다."
          buttons={
            <CalendarViewToolbar
              viewType={calendar.viewType}
              onViewTypeChange={handleViewTypeChange}
              workspaceId={workspaceId}
            />
          }
        />
      }
    >
      {!workspaceId ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          워크스페이스를 선택해주세요
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden pt-3 gap-2">
          <CalendarNavigation
            title={calendar.title}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
          />
          {calendar.viewType === 'month' && (
            <MonthView
              schedules={schedules}
              currentDate={calendar.currentDate}
              selectedDate={calendar.selectedDate}
              onSelectDate={handleSelectDate}
              workspaceId={workspaceId}
            />
          )}
          {calendar.viewType === 'week' && (
            <WeekView
              schedules={schedules}
              currentDate={calendar.currentDate}
              selectedDate={calendar.selectedDate}
              onSelectDate={handleSelectDate}
              workspaceId={workspaceId}
            />
          )}
          {calendar.viewType === 'day' && (
            <DayView
              schedules={schedules}
              currentDate={calendar.currentDate}
              workspaceId={workspaceId}
            />
          )}
        </div>
      )}
    </TabContainer>
  )
}
```

- `scrollable={false}` — 뷰가 내부 스크롤 관리
- workspaceId null → 안내 메시지 (TodoPage 동일 패턴)
- tabSearchParams 동기화: viewType, currentDate 저장/복원

### CalendarViewToolbar (`widgets/calendar/ui/CalendarViewToolbar.tsx`)

```typescript
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group'
import { Button } from '@shared/ui/button'
import { ScheduleFormDialog } from '@features/schedule/manage-schedule'
import type { CalendarViewType } from '@features/schedule/manage-schedule'

interface Props {
  viewType: CalendarViewType
  onViewTypeChange: (type: CalendarViewType) => void
  workspaceId: string | null
}

export function CalendarViewToolbar({
  viewType,
  onViewTypeChange,
  workspaceId,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        value={viewType}
        onValueChange={(v) => v && onViewTypeChange(v as CalendarViewType)}
        size="sm"
        variant="outline"
      >
        <ToggleGroupItem value="month">월</ToggleGroupItem>
        <ToggleGroupItem value="week">주</ToggleGroupItem>
        <ToggleGroupItem value="day">일</ToggleGroupItem>
      </ToggleGroup>
      {workspaceId && (
        <ScheduleFormDialog
          workspaceId={workspaceId}
          trigger={<Button size="sm">+ 일정 추가</Button>}
        />
      )}
    </div>
  )
}
```

### CalendarNavigation

```typescript
import { Button } from '@shared/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  title: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function CalendarNavigation({ title, onPrev, onNext, onToday }: Props) {
  return (
    <div className="flex flex-col @[400px]:flex-row @[400px]:items-center gap-1 px-1">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onToday}>
          오늘
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onPrev}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onNext}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <span className="text-base font-semibold @[400px]:ml-2">{title}</span>
    </div>
  )
}
```

- Container query 반응형: `< 400px` → 2행, `>= 400px` → 1행

---

## 9. 뷰별 반응형 명세

### 9.1 월간 뷰 (MonthView)

| 범위      | 셀 높이  | 일정 표시                        | 최대              | 여러 날       |
| --------- | -------- | -------------------------------- | ----------------- | ------------- |
| < 400px   | min-h-10 | ScheduleDot (색상 도트 size-1.5) | 3                 | 없음 (도트만) |
| 400~800px | min-h-20 | 제목 1줄 truncate text-[10px]    | 3 + "+N개 더보기" | ScheduleBar   |
| >= 800px  | min-h-24 | 시간+제목 text-[11px]            | 4 + "+N개 더보기" | ScheduleBar   |

**소형 (< 400px) 전용 하단 목록**: `selectedDate` 있을 때 그리드 아래 해당 날짜 일정 목록 표시

**MonthDayCell** 스타일:

```
border-b border-r border-border p-1 overflow-hidden cursor-pointer relative
!isCurrentMonth → bg-muted/30 text-muted-foreground
isToday → bg-primary/5
isSelected → ring-2 ring-primary ring-inset
isOver (DnD) → bg-accent
오늘 날짜 숫자 → bg-primary text-primary-foreground rounded-full size-6 leading-6 text-center
```

**DnD**: `@dnd-kit/core` — `useDraggable` + `useDroppable` (sortable 아님)

- sensors: PointerSensor delay 200ms tolerance 5
- onDragEnd: over.id (dateKey) → daysDelta 계산 → `moveScheduleByDays()` → `move` IPC

**여러 날 바 렌더링 알고리즘**:

1. `splitBarByWeeks()` → 주별 세그먼트
2. 각 week-row 내 lane 배치 (위→아래 빈 lane 할당)
3. absolute positioning: top = lane \* (barHeight + gap), left/width = 열 기반 %
4. `isStart` → `rounded-l-sm`, `isEnd` → `rounded-r-sm`

### 9.2 주간 뷰 (WeekView)

| 범위      | 처리                             | 시간당 높이 | 시간 라벨        | 일정 블록          |
| --------- | -------------------------------- | ----------- | ---------------- | ------------------ |
| < 400px   | DayView 위임 + 상단 날짜 선택 바 | —           | —                | —                  |
| 400~800px | 7열 타임라인                     | 40px        | w-10 text-[10px] | 제목만 text-[10px] |
| >= 800px  | 7열 타임라인                     | 60px        | w-14 text-xs     | 제목+시간 text-xs  |

**구조**: 요일 헤더 → 종일 일정 영역 → TimeGrid (ScrollArea)

**TimeGrid** (주간/일간 공용):

- `ScrollArea` 감싸기, height = 24 \* hourHeight
- 24개 시간 라벨 + 가로선
- 초기 스크롤: 현재 시각 또는 08:00 위치
- 빈 시간 클릭: Y좌표 → 시간 계산 (15분 스냅) → ScheduleFormDialog 열기

**DnD**: `useDraggable` transform.y 직접 적용 (세로 이동)

- onDragEnd: deltaY → minutesDelta (15분 스냅) → `moveScheduleByMinutes()` → `move` IPC

### 9.3 일간 뷰 (DayView)

| 범위      | 시간당 높이 | 시간 라벨        | 일정 표시                     |
| --------- | ----------- | ---------------- | ----------------------------- |
| < 400px   | 50px        | w-8 text-[9px]   | 제목만                        |
| 400~800px | 60px        | w-10 text-[10px] | 제목 + 시간                   |
| >= 800px  | 60px        | w-14 text-xs     | 제목 + 시간 + 설명 1줄 + 장소 |

**겹침 처리**: `layoutOverlappingSchedules()` → column/totalColumns → ScheduleBlock에 전달

---

## 10. Dialog / Popover 명세

### ScheduleFormDialog (생성/수정 겸용)

**Props:**

```typescript
interface Props {
  workspaceId: string
  trigger?: React.ReactNode // 생성 모드
  initialData?: ScheduleItem // 수정 모드
  defaultStartDate?: Date // 빈 시간 클릭 시 사전 설정
  defaultEndDate?: Date
  open?: boolean // controlled
  onOpenChange?: (open: boolean) => void
}
```

**폼 필드:**
| 필드 | 컴포넌트 | 필수 | 비고 |
|------|---------|------|------|
| 제목 | Input | O | max 200 |
| 종일 | Switch | — | allDay 토글 |
| 시작일 | DatePickerButton (clearable=false) | O | — |
| 시작시간 | Select (시: 0~23, 분: 0/15/30/45) | O | allDay=true 숨김 |
| 종료일 | DatePickerButton (clearable=false) | O | — |
| 종료시간 | Select (시: 0~23, 분: 0/15/30/45) | O | allDay=true 숨김 |
| 장소 | Input | — | — |
| 설명 | Textarea | — | — |
| 우선순위 | Select | — | low/medium/high |
| 색상 | ColorPicker | — | 프리셋 8개 |

**Zod 스키마**: title, description, location, allDay, priority, color (zod)

- startDate/endDate/startHour/startMinute/endHour/endMinute는 별도 useState (CreateTodoDialog 패턴)

### DeleteScheduleDialog

기존 `DeleteTodoDialog` 패턴의 `AlertDialog`. `open`+`onOpenChange` controlled 및 `trigger` 방식 모두 지원.

### ScheduleDetailPopover

Popover 기반 상세 보기:

- 헤더: 색상 도트 + 제목
- 상세: 날짜(CalendarIcon), 시간(Clock), 장소(MapPin), 설명(FileText)
- LinkedTodoList (compact)
- 액션: 수정 / 삭제 버튼

### LinkedTodoList + TodoLinkPopover

**LinkedTodoList**: 연결된 Todo 목록 + 해제 + "할 일 연결" 버튼

- compact=true: Popover 내부 (최대 3개)
- compact=false: Dialog 내부 (전체)

**TodoLinkPopover**: 검색 Input + Todo 목록 ScrollArea

- `useTodosByWorkspace()` 전체 조회 → 클라이언트 필터링
- 이미 연결된 Todo는 disabled + Check 아이콘

---

## 11. 라우팅 연결

### `src/renderer/src/app/layout/model/pane-routes.tsx` 변경

```typescript
const CalendarPage = lazy(() => import('@pages/calendar'))

// PANE_ROUTES에 추가
{ pattern: ROUTES.CALENDAR, component: CalendarPage }
```

> **기존 인프라 확인**: `TabType = 'calendar'`, `ROUTES.CALENDAR = '/calendar'`, `TAB_ICON.calendar = Calendar` 이미 선언됨. `PANE_ROUTES`에 CalendarPage만 등록하면 됨.

---

## 12. 기존 패턴과의 차이 요약

| 항목              | 기존                              | Schedule                                     |
| ----------------- | --------------------------------- | -------------------------------------------- |
| 복합 PK           | 미사용                            | `schedule_todos` 첫 도입                     |
| `date-fns`        | `format` 1개                      | 15+ 함수 추가                                |
| DnD               | `useSortable` + `SortableContext` | `useDraggable` + `useDroppable` (셀 간 이동) |
| Optimistic update | 미사용                            | 동일 (미사용)                                |
| workspaceId FK    | notNull()                         | nullable (전역 일정)                         |
| tabSearchParams   | view, filter                      | viewType, currentDate                        |

---

## 13. Success Criteria

- [ ] Schedule CRUD (생성/조회/수정/삭제) 정상 동작
- [ ] workspaceId cascade delete
- [ ] schedule_todos cascade (양방향)
- [ ] 날짜 범위 조회 정확 (`startAt <= range.end AND endAt >= range.start`)
- [ ] allDay 종일 일정 시간 보정
- [ ] `startAt <= endAt` 서비스 검증
- [ ] 월간 뷰: 3단계 반응형 + 여러 날 바 + DnD
- [ ] 주간 뷰: < 400px 일간 위임 + 7열 타임라인 + DnD
- [ ] 일간 뷰: 겹침 레이아웃 + 빈 시간 클릭 → 생성
- [ ] ScheduleFormDialog: 생성/수정, allDay, DatePicker, 시간 Select, ColorPicker
- [ ] DeleteScheduleDialog: AlertDialog
- [ ] ScheduleDetailPopover: 상세 + 수정/삭제
- [ ] CalendarNavigation: 오늘/이전/다음 + 반응형
- [ ] CalendarViewToolbar: ToggleGroup + 일정 추가
- [ ] tabSearchParams viewType/currentDate 복원
- [ ] Todo 연결: LinkedTodoList + TodoLinkPopover (N:M)
- [ ] FSD Import 규칙 준수
- [ ] TypeScript 컴파일 에러 없음
- [ ] Container query 전용 (`@[400px]`, `@[800px]`)
- [ ] shadcn/ui + 디자인 토큰 일관성
