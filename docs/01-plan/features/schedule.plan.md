# Schedule (캘린더/일정) Feature Plan

## Overview

Rally 앱에 일정(Schedule) 기능을 추가한다.
Schedule은 별도 Entity로 관리되며, 기존 Todo와 연결(link)할 수 있다.
월간/주간/일간 3가지 캘린더 뷰를 제공하고, 모든 뷰는 container query 반응형(@[400px], @[800px])이다.
캘린더는 직접 구현하며(외부 캘린더 라이브러리 미사용), shadcn/ui 기반 UI 일관성을 유지한다.

> **기존 인프라**: `TabType = 'calendar'`, `ROUTES.CALENDAR = '/calendar'`, `TAB_ICON.calendar = Calendar` (lucide-react), 사이드바 "캘린더" 항목이 이미 선언됨 (`tab-url.ts`). `PANE_ROUTES`에 CalendarPage만 등록하면 됨.

---

## 아키텍처 원칙

```
SQLite (schedules, schedule_todos 테이블) → 일정 데이터 영구 저장 (workspaceId cascade)
IPC (main ↔ renderer)                    → window.api.schedule.* 브리지 통신
entities/schedule                         → 타입 + React Query hooks
features/schedule/manage-schedule         → 월간/주간/일간 뷰, DnD, 등록/수정 Dialog
widgets/calendar                          → CalendarViewToolbar (TodoViewToolbar 패턴)
pages/calendar                            → CalendarPage (TabContainer + TabHeader + 뷰 전환)
```

### UI 디자인 시스템 원칙

- **모든 UI 컴포넌트는 shadcn/ui 기반으로 구현** (`src/shared/ui/` style: new-york)
- 커스텀 스타일보다 shadcn 컴포넌트 우선 사용 (Button, Badge, Dialog, AlertDialog, Popover, Select, ToggleGroup, Switch, ScrollArea 등)
- 아이콘은 Lucide React 통일
- 색상/간격은 Tailwind CSS v4 + 프로젝트 CSS 변수 (`--primary`, `--muted`, `--muted-foreground`, `--border`, `--destructive`, `--accent` 등) 준수
- 임의 색상값 하드코딩 금지 — 반드시 디자인 토큰 참조
- 캘린더 뷰는 직접 구현 (외부 캘린더 라이브러리 사용 금지)
- 기존 `@shared/ui/calendar` (react-day-picker)는 **ScheduleFormDialog의 DatePickerButton 내부에서만** 사용

---

## 데이터 스키마

### SQLite `schedules` 테이블

| 필드          | 타입                                | 설명                                      |
| ------------- | ----------------------------------- | ----------------------------------------- |
| `id`          | text PK                             | nanoid                                    |
| `workspaceId` | text NULL → workspaces.id (cascade) | 워크스페이스 소속. null이면 전역 일정     |
| `title`       | text NOT NULL                       | 일정 제목                                 |
| `description` | text NULL                           | 상세 설명                                 |
| `location`    | text NULL                           | 장소                                      |
| `allDay`      | integer NOT NULL DEFAULT 0          | boolean (mode: 'boolean'). 종일 일정 여부 |
| `startAt`     | integer (timestamp_ms) NOT NULL     | 시작 시각                                 |
| `endAt`       | integer (timestamp_ms) NOT NULL     | 종료 시각                                 |
| `color`       | text NULL                           | hex 색상 (null이면 priority별 기본 색상)  |
| `priority`    | text NOT NULL DEFAULT 'medium'      | 'low' \| 'medium' \| 'high'               |
| `createdAt`   | integer (timestamp_ms) NOT NULL     |                                           |
| `updatedAt`   | integer (timestamp_ms) NOT NULL     |                                           |

### Drizzle 스키마 코드

```typescript
// src/main/db/schema/schedule.ts
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

### SQLite `schedule_todos` 테이블 (연결 테이블)

| 필드         | 타입                                   | 설명                              |
| ------------ | -------------------------------------- | --------------------------------- |
| `scheduleId` | text NOT NULL → schedules.id (cascade) | 일정 ID. 일정 삭제 시 연결도 삭제 |
| `todoId`     | text NOT NULL → todos.id (cascade)     | Todo ID. Todo 삭제 시 연결도 삭제 |

- **복합 PK**: (scheduleId, todoId) — 중복 연결 방지
- 양방향 cascade: 일정/Todo 삭제 시 연결만 삭제, 원본 유지

> **참고**: 프로젝트 내 복합 PK 사용 사례가 없음 (첫 도입). `primaryKey()` 함수는 `drizzle-orm/sqlite-core`에서 export 가능.

```typescript
// src/main/db/schema/schedule-todo.ts
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

### 비즈니스 규칙

- `startAt <= endAt` 필수 (서비스 레이어에서 검증, ValidationError)
- `allDay = true`일 때: startAt → 00:00:00.000, endAt → 23:59:59.999 (서비스에서 자동 보정)
- 여러 날에 걸치는 일정 허용 (startAt.date !== endAt.date)
- `color`가 null이면 priority별 기본 색상 적용 (renderer에서 처리)
- Todo 연결: N:M (하나의 일정에 여러 Todo, 하나의 Todo에 여러 일정)
- DnD move: duration(endAt - startAt) 유지하며 시작 시간만 변경

---

## IPC 인터페이스

### 채널 목록

```
schedule:findByWorkspace  (workspaceId, range)         → ScheduleItem[]
schedule:findById         (scheduleId)                 → ScheduleItem
schedule:create           (workspaceId, data)          → ScheduleItem
schedule:update           (scheduleId, data)           → ScheduleItem
schedule:remove           (scheduleId)                 → void
schedule:move             (scheduleId, startAt, endAt) → ScheduleItem  (DnD 전용)
schedule:linkTodo         (scheduleId, todoId)         → void
schedule:unlinkTodo       (scheduleId, todoId)         → void
schedule:getLinkedTodos   (scheduleId)                 → TodoItem[]
```

### Preload Bridge 타입 (index.d.ts)

```typescript
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

### Preload Bridge 구현 (index.ts)

```typescript
// src/preload/index.ts — api 객체에 추가
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
}
```

---

## Service Layer (Main Process)

### 서비스 구조 (기존 todoService 패턴 준수)

```typescript
// src/main/services/schedule.ts
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { scheduleRepository } from '../repositories/schedule'
import { scheduleTodoRepository } from '../repositories/schedule-todo'
import type { Schedule } from '../repositories/schedule'

export interface ScheduleItem { ... }        // domain return type
export interface CreateScheduleData { ... }  // input DTO
export interface UpdateScheduleData { ... }  // update DTO

// private mapper (timestamp_ms → Date 변환)
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
    updatedAt: new Date(row.updatedAt as unknown as number),
  }
}

export const scheduleService = { ... }
```

### 메서드 상세

**`findByWorkspace(workspaceId, range)`**

- workspace 유효성 확인 (NotFoundError)
- WHERE: `startAt <= range.end AND endAt >= range.start` (범위 겹침 조건)
- ORDER BY: startAt ASC
- ScheduleItem[] 반환

**`findById(scheduleId)`**

- schedule 존재 확인 (NotFoundError)
- ScheduleItem 반환

**`create(workspaceId, data)`**

- workspace 존재 확인 (workspaceId 있을 때)
- `title.trim()` 빈 문자열 → ValidationError
- `startAt <= endAt` → ValidationError
- nanoid로 id 생성
- allDay=true → startAt 보정(00:00:00.000), endAt 보정(23:59:59.999)
- `createdAt = new Date()`, `updatedAt = new Date()`
- DB insert → ScheduleItem 반환

**`update(scheduleId, data)`**

- schedule 존재 확인 (NotFoundError)
- startAt/endAt 변경 시 기존값과 merge 후 `startAt <= endAt` 재검증
- allDay 변경 시 시간 자동 보정
- `updatedAt = new Date()`
- DB update → ScheduleItem 반환

**`remove(scheduleId)`**

- schedule 존재 확인
- DB delete (schedule_todos cascade)

**`move(scheduleId, startAt, endAt)`**

- schedule 존재 확인
- `startAt <= endAt` 검증
- startAt, endAt, updatedAt만 업데이트 (DnD 최적화)

**`linkTodo(scheduleId, todoId)`**

- schedule, todo 존재 확인 (NotFoundError)
- INSERT OR IGNORE (멱등성)

**`unlinkTodo(scheduleId, todoId)`**

- DELETE WHERE (연결 없어도 에러 안남, 멱등성)

**`getLinkedTodos(scheduleId)`**

- schedule 존재 확인
- schedule_todos + todos JOIN → TodoItem[] 반환
- todoService의 toTodoItem 매퍼 재사용 (import)

---

## Renderer Layer (FSD 구조)

### 레이어 구성

```
entities/schedule/
  model/types.ts              → ScheduleItem 타입 재선언
  model/queries.ts            → React Query hooks (9개)
  index.ts                    → barrel export

features/schedule/
  manage-schedule/
    model/
      use-calendar.ts           → 캘린더 날짜 네비게이션/선택 상태 관리 훅
      calendar-utils.ts         → 날짜 계산 유틸
      schedule-color.ts         → 색상 프리셋 + priority별 기본 색상
    ui/
      CalendarNavigation.tsx    → 네비게이션 (오늘, <, >, 기간 텍스트)
      MonthView.tsx             → 월간 캘린더 뷰
      WeekView.tsx              → 주간 캘린더 뷰
      DayView.tsx               → 일간 캘린더 뷰
      MonthDayCell.tsx          → 월간 날짜 셀 (droppable)
      TimeGrid.tsx              → 주간/일간 공용 시간 그리드
      ScheduleBlock.tsx         → 시간 일정 블록 (draggable)
      ScheduleBar.tsx           → 종일/여러날 일정 바 (draggable)
      ScheduleDot.tsx           → 소형 일정 도트 (< 400px)
      ScheduleFormDialog.tsx    → 일정 생성/수정 Dialog
      DeleteScheduleDialog.tsx  → 삭제 확인 AlertDialog
      ScheduleDetailPopover.tsx → 일정 상세 Popover
      LinkedTodoList.tsx        → 연결된 Todo 목록
      TodoLinkPopover.tsx       → Todo 검색/선택 Popover
      CurrentTimeIndicator.tsx  → 현재 시각 빨간 선
      ColorPicker.tsx           → 색상 프리셋 선택기
    index.ts

widgets/calendar/
  ui/CalendarViewToolbar.tsx  → 뷰 전환 + 일정 추가 (TodoViewToolbar 패턴)
  index.ts

pages/calendar/
  ui/CalendarPage.tsx         → TabContainer + TabHeader + 뷰 전환
  index.ts
```

### FSD Import 규칙

```
pages/calendar      → widgets/calendar, features/schedule, entities/schedule, entities/todo (허용)
widgets/calendar    → features/schedule, entities/schedule, shared (허용)
features/schedule   → entities/schedule, entities/todo, shared (허용)
entities/schedule   → shared (허용)
```

---

## calendar-utils.ts — 날짜 계산 유틸

> **date-fns 신규 import**: `addDays`, `addWeeks`, `addMonths`, `subDays`, `subWeeks`, `subMonths`, `startOfMonth`, `endOfMonth`, `startOfWeek`, `endOfWeek`, `startOfDay`, `endOfDay`, `getDay`, `getDaysInMonth`, `isSameDay`, `isSameMonth`, `isWithinInterval`, `differenceInMinutes`, `differenceInDays`, `format`. 현재는 `format`만 사용 중.

```typescript
/** 월간 그리드 (5~6주 x 7일 = 35~42개 날짜) */
interface MonthGridDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
}
function getMonthGrid(year: number, month: number): MonthGridDay[][]
// 각 행 = 1주 (일~토), 첫 행은 해당 월 1일이 포함된 주

/** 주간 날짜 배열 (일~토 7일) */
function getWeekDates(date: Date): Date[]
// date가 속한 주의 일~토 7개 Date 반환 (startOfWeek 사용)

/** 시간 슬롯 (00~23시) */
interface TimeSlot {
  hour: number
  label: string
}
function getTimeSlots(): TimeSlot[]
// [{ hour: 0, label: '00:00' }, ..., { hour: 23, label: '23:00' }]

/** 날짜 비교 */
function isSameDay(a: Date, b: Date): boolean
function isToday(date: Date): boolean

/** 일정이 특정 날짜에 해당하는지 (여러 날 포함) */
function isScheduleOnDate(schedule: ScheduleItem, date: Date): boolean

/** 월간 뷰: 일정의 주(row) 내 가로 배치 계산 */
interface ScheduleBarLayout {
  startCol: number // 0~6 (일~토)
  span: number // 차지하는 열 수 (1~7)
}
function getScheduleBarLayout(
  schedule: ScheduleItem,
  weekStart: Date,
  weekEnd: Date
): ScheduleBarLayout | null
// null = 해당 주에 해당 일정 없음

/** 시간 → 픽셀 위치 */
function timeToPosition(date: Date, hourHeight: number): number
// (date.getHours() + date.getMinutes() / 60) * hourHeight

/** 일정 높이 계산 */
function scheduleHeight(startAt: Date, endAt: Date, hourHeight: number): number
// differenceInMinutes(endAt, startAt) / 60 * hourHeight, 최소 20px

/** DnD: 날짜 이동 (duration 유지) */
function moveScheduleByDays(
  schedule: ScheduleItem,
  daysDelta: number
): { startAt: Date; endAt: Date }

/** DnD: 분 단위 이동 (15분 스냅) */
function moveScheduleByMinutes(
  schedule: ScheduleItem,
  minutesDelta: number
): { startAt: Date; endAt: Date }
// minutesDelta를 15분 단위로 snap: Math.round(minutesDelta / 15) * 15

/** 겹치는 일정 수평 분할 레이아웃 (일간/주간 뷰) */
interface LayoutedSchedule {
  schedule: ScheduleItem
  column: number // 0-based 수평 위치
  totalColumns: number // 동시 겹침 최대 수
}
function layoutOverlappingSchedules(schedules: ScheduleItem[]): LayoutedSchedule[]
// 알고리즘:
// 1. startAt ASC 정렬
// 2. 각 일정마다 이전 일정들과 시간 겹침 확인
// 3. 겹치는 그룹(cluster) 내에서 greedy column 할당 (가장 왼쪽 빈 column)
// 4. 그룹 내 모든 일정에 동일 totalColumns 값 부여

/** 월간 뷰: 여러 날 일정 바의 주(row)별 분할 */
interface WeekBarSegment {
  weekIndex: number // 몇 번째 주 row인지
  startCol: number // 해당 주 내 시작 열 (0~6)
  span: number // 해당 주 내 차지하는 열 수
  isStart: boolean // 이 세그먼트가 일정의 진짜 시작인지
  isEnd: boolean // 이 세그먼트가 일정의 진짜 끝인지
}
function splitBarByWeeks(schedule: ScheduleItem, monthGrid: MonthGridDay[][]): WeekBarSegment[]
// 여러 날 일정이 주(row) 경계를 넘을 때 세그먼트로 분할
// isStart/isEnd로 좌/우 라운드 처리 판단
```

---

## use-calendar.ts — 캘린더 상태 관리 훅

```typescript
type CalendarViewType = 'month' | 'week' | 'day'

interface UseCalendarOptions {
  initialViewType?: CalendarViewType // tabSearchParams에서 복원
  initialDate?: string // ISO string, tabSearchParams에서 복원
}

interface UseCalendarReturn {
  // 상태
  currentDate: Date
  selectedDate: Date | null
  viewType: CalendarViewType

  // 액션
  setViewType: (type: CalendarViewType) => void
  selectDate: (date: Date) => void
  goToday: () => void
  goPrev: () => void // month: -1월, week: -7일, day: -1일
  goNext: () => void // month: +1월, week: +7일, day: +1일

  // 파생 값
  title: string // "2026년 3월" | "2026년 3월 1일 ~ 7일" | "2026년 3월 1일 (일)"
  dateRange: ScheduleDateRange // 현재 뷰의 데이터 조회 범위
}

function useCalendar(options?: UseCalendarOptions): UseCalendarReturn
```

- `viewType`, `currentDate`, `selectedDate`는 **useState** (local state)
- 날짜 선택 시 해당 날짜로 `currentDate`도 업데이트
- `dateRange` 자동 계산:
  - month → startOfMonth ~ endOfMonth (+ 앞뒤 주 padding 포함 — getMonthGrid 범위)
  - week → startOfWeek ~ endOfWeek
  - day → startOfDay ~ endOfDay

### CalendarPage에서 tabSearchParams 동기화

```typescript
// pages/calendar/ui/CalendarPage.tsx (TodoPage 패턴 준수)
const tabSearchParams = useTabStore((s) => (tabId ? s.tabs[tabId]?.searchParams : undefined))
const navigateTab = useTabStore((s) => s.navigateTab)

const calendar = useCalendar({
  initialViewType: (tabSearchParams?.viewType as CalendarViewType) || 'month',
  initialDate: tabSearchParams?.currentDate
})

// viewType 변경 시 searchParams 동기화
function handleViewTypeChange(type: CalendarViewType): void {
  calendar.setViewType(type)
  if (tabId) {
    navigateTab(tabId, { searchParams: { ...tabSearchParams, viewType: type } })
  }
}

// currentDate 변경 시 searchParams 동기화
// → goPrev/goNext/goToday/selectDate 후 tabSearchParams에 currentDate ISO string 저장
```

> **핵심**: 탭을 닫았다 다시 열었을 때 뷰 타입과 날짜가 복원됨 (TodoPage의 view/filter 복원 패턴과 동일)

---

## schedule-color.ts — 색상 관리

```typescript
export const SCHEDULE_COLOR_PRESETS = [
  { label: '기본', value: null },
  { label: '빨강', value: '#ef4444' },
  { label: '주황', value: '#f97316' },
  { label: '노랑', value: '#eab308' },
  { label: '초록', value: '#22c55e' },
  { label: '파랑', value: '#3b82f6' },
  { label: '보라', value: '#a855f7' },
  { label: '분홍', value: '#ec4899' }
]

export const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#3b82f6',
  low: '#6b7280'
}

export function getScheduleColor(schedule: ScheduleItem): string {
  return schedule.color ?? PRIORITY_COLORS[schedule.priority]
}
```

---

## UI 구성 — 상세 명세

### CalendarPage (pages/calendar)

TodoPage 패턴을 **정확히** 따른다.

```tsx
// pages/calendar/ui/CalendarPage.tsx
interface Props {
  tabId?: string // PageProps에서 자동 주입 (PaneContent.tsx)
}

export function CalendarPage({ tabId }: Props): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const tabSearchParams = useTabStore((s) => (tabId ? s.tabs[tabId]?.searchParams : undefined))
  const navigateTab = useTabStore((s) => s.navigateTab)

  const calendar = useCalendar({
    initialViewType: (tabSearchParams?.viewType as CalendarViewType) || 'month',
    initialDate: tabSearchParams?.currentDate
  })

  const { data: schedules = [] } = useSchedulesByWorkspace(workspaceId, calendar.dateRange)

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

- `scrollable={false}` — 뷰가 내부 스크롤 관리 (TimeGrid의 ScrollArea)
- `workspaceId` null 체크 → 안내 메시지 (TodoPage 동일 패턴)

### CalendarViewToolbar (widgets/calendar)

`TodoViewToolbar` 패턴을 따르는 위젯.

```tsx
// widgets/calendar/ui/CalendarViewToolbar.tsx
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group'
import { Button } from '@shared/ui/button'
import { ScheduleFormDialog } from '@features/schedule/manage-schedule'

export function CalendarViewToolbar({ viewType, onViewTypeChange, workspaceId }) {
  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        value={viewType}
        onValueChange={(v) => v && onViewTypeChange(v)}
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

- ToggleGroup size: `sm` (h-8, toggle.tsx에서 확인)
- ToggleGroup variant: `outline` (테두리 있는 스타일)

### CalendarNavigation

네비게이션 전용 바. 헤더 아래, 뷰 위에 위치.

```
≥ 400px:
┌───────────────────────────────────────┐
│ [오늘]  [<] [>]    2026년 3월         │
└───────────────────────────────────────┘

< 400px:
┌──────────────────────────┐
│  [<]   2026년 3월   [>]  │
│  [오늘]                  │
└──────────────────────────┘
```

```tsx
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
```

- Button size: `sm` (h-8), `icon-sm` (size-8) — 모두 존재 확인됨
- `< 400px`: flex-col → 2행, `≥ 400px`: flex-row → 1행

---

### 월간 뷰 (MonthView)

#### Container Query 반응형

**< 400px (소형):**

```
┌───┬───┬───┬───┬───┬───┬───┐
│일 │월 │화 │수 │목 │금 │토 │
├───┼───┼───┼───┼───┼───┼───┤
│ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │
│●● │ ● │   │   │●  │   │   │  ← ScheduleDot (색상 도트)
├───┼───┼───┼───┼───┼───┼───┤
│...│   │   │   │   │   │   │
└───┴───┴───┴───┴───┴───┴───┘
── 3월 1일 (일) ──────────────
│ 10:00 팀 미팅               │  ← 하단 일정 목록
│ 14:00 점심 약속             │
──────────────────────────────
```

- 셀 min-h: `min-h-10`
- 도트: `size-1.5 rounded-full` + 일정 color, 최대 3개
- 날짜 클릭 → selectedDate 설정 → 하단 목록 표시
- 하단 목록: selectedDate가 있을 때만 렌더링

**400~800px (중형):**

- 셀 min-h: `min-h-20`
- 일정 텍스트: 제목 1줄 truncate, `text-[10px]`
- 최대 3개, 초과: "+N개 더보기" (클릭 → Popover 전체 목록)
- 여러 날 일정: ScheduleBar (가로 바)

**≥ 800px (대형):**

- 셀 min-h: `min-h-24`
- 일정 텍스트: 시간 + 제목 (예: "10:00 팀 미팅"), `text-[11px]`
- 최대 4개, 초과: "+N개 더보기"
- 여러 날 바 + 시간 일정 혼합

#### 날짜 셀 (MonthDayCell)

```tsx
// useDroppable({ id: dateKey }) 사용 — @dnd-kit/core (sortable 아님)
<div
  ref={setNodeRef}
  className={cn(
    'border-b border-r border-border p-1 overflow-hidden cursor-pointer relative',
    !day.isCurrentMonth && 'bg-muted/30 text-muted-foreground',
    day.isToday && 'bg-primary/5',
    isSelected && 'ring-2 ring-primary ring-inset',
    isOver && 'bg-accent'
  )}
  onClick={() => onSelectDate(day.date)}
>
  <span
    className={cn(
      'text-xs font-medium inline-block',
      day.isToday && 'bg-primary text-primary-foreground rounded-full size-6 leading-6 text-center'
    )}
  >
    {day.date.getDate()}
  </span>
  {/* 일정 렌더링: ScheduleDot (소형) / ScheduleBar + 텍스트 (중/대형) */}
</div>
```

#### 여러 날 일정 바 렌더링 알고리즘

1. `splitBarByWeeks(schedule, monthGrid)` → 주(row)별 세그먼트 분할
2. 각 week-row 내에서 바를 "lane"에 배치 (위→아래 순서로 빈 lane 할당)
3. 바 렌더링: absolute positioning
   - `top`: lane \* (barHeight + gap)
   - `left`: `${startCol * (100/7)}%`
   - `width`: `${span * (100/7)}%`
4. `isStart` → `rounded-l-sm`, `isEnd` → `rounded-r-sm` (주 경계에서 잘린 바는 해당 쪽 라운드 없음)
5. 텍스트: isStart인 세그먼트에만 제목 표시

#### DnD (월간) — `@dnd-kit/core` only

```tsx
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'

// sensors: delay 200ms (클릭과 드래그 구분)
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
)

// 각 일정 = useDraggable({ id: schedule.id, data: { schedule } })
// 각 날짜 셀 = useDroppable({ id: dateKey })

// onDragEnd: over.id (dateKey) 파싱 → daysDelta 계산 → moveScheduleByDays() → move IPC
```

> **중요**: `useSortable` 사용하지 않음. 캘린더는 리스트 정렬이 아니라 셀 간 이동이므로 `useDraggable` + `useDroppable` 조합.

---

### 주간 뷰 (WeekView)

#### Container Query 반응형

**< 400px:**

- DayView로 위임 (selectedDate 또는 currentDate의 날짜). 사실상 일간 뷰와 동일 렌더링.
- 상단에 요일 가로 스크롤 날짜 선택 바 표시 (어떤 날짜인지 탭으로 전환)
- DnD: 세로만 (시간 이동)

**400~800px:**

- 7열 타임라인
- 시간당 높이: 40px
- 시간 라벨: `w-10 text-[10px]`
- 일정 블록: 제목만, `text-[10px]`

**≥ 800px:**

- 7열 타임라인
- 시간당 높이: 60px
- 시간 라벨: `w-14 text-xs`
- 일정 블록: 제목 + 시간, `text-xs`

#### 구조

```
┌──────┬──────────────────────────────────────────┐
│      │ 일 1   월 2   화 3   수 4   목 5 ...    │  요일 헤더
├──────┼──────────────────────────────────────────┤
│ 종일 │ [출장━━━━━━━━━━━]                         │  종일 일정 영역
├──────┼──────────────────────────────────────────┤
│      │                                          │
│09:00 │      ┌────┐                              │  TimeGrid (ScrollArea)
│10:00 │      │미팅│         ┌────┐               │
│11:00 │      └────┘         │회의│               │
│12:00 │                     └────┘               │
│──────│──── 현재 시각 빨간선 ────────────────────│
│      │                                          │
└──────┴──────────────────────────────────────────┘
```

#### TimeGrid (주간/일간 공용)

```tsx
<ScrollArea className="flex-1 min-h-0">
  <div className="relative" style={{ height: 24 * hourHeight }}>
    {/* 시간 라벨 + 가로선 24개 */}
    {timeSlots.map((slot) => (
      <div
        key={slot.hour}
        className="absolute left-0 right-0 border-t border-border"
        style={{ top: slot.hour * hourHeight }}
      >
        <span className="absolute -top-2.5 left-0 w-10 @[800px]:w-14 text-right pr-2 text-[10px] @[800px]:text-xs text-muted-foreground">
          {slot.label}
        </span>
      </div>
    ))}

    {/* 일정 블록 영역 */}
    <div className="absolute top-0 bottom-0 left-10 @[800px]:left-14 right-0">{children}</div>

    <CurrentTimeIndicator hourHeight={hourHeight} />
  </div>
</ScrollArea>
```

- 초기 스크롤: 현재 시각 기준 (또는 08:00 위치)
- 빈 시간 클릭: click Y 좌표 → 시간 계산 (15분 스냅) → ScheduleFormDialog 열기 (startAt 사전 설정)

#### ScheduleBlock (시간 일정, draggable)

```tsx
const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
  id: schedule.id,
  data: { schedule }
})

<div
  ref={setNodeRef}
  {...attributes}
  {...listeners}
  className={cn(
    'absolute rounded-md px-1.5 py-0.5 cursor-pointer overflow-hidden',
    'text-white text-[10px] @[800px]:text-xs leading-tight',
    isDragging && 'opacity-50 shadow-lg z-20'
  )}
  style={{
    top: timeToPosition(schedule.startAt, hourHeight),
    height: Math.max(scheduleHeight(schedule.startAt, schedule.endAt, hourHeight), 20),
    left: `${(column / totalColumns) * 100}%`,
    width: `calc(${(1 / totalColumns) * 100}% - 2px)`,
    backgroundColor: getScheduleColor(schedule),
    transform: transform ? `translate(0, ${transform.y}px)` : undefined,
  }}
  onClick={(e) => { e.stopPropagation(); openDetail(schedule) }}
>
  <div className="font-medium truncate">{schedule.title}</div>
  <div className="hidden @[400px]:block truncate opacity-80">
    {format(schedule.startAt, 'HH:mm')} - {format(schedule.endAt, 'HH:mm')}
  </div>
</div>
```

> **DnD transform**: `useDraggable`에서 받은 `transform.y`를 직접 적용 (세로 이동). `@dnd-kit/sortable`의 CSS.Transform 유틸 불필요.

#### CurrentTimeIndicator

```tsx
const [now, setNow] = useState(new Date())
useEffect(() => {
  const id = setInterval(() => setNow(new Date()), 60_000)
  return () => clearInterval(id)
}, [])

<div
  className="absolute left-0 right-0 z-10 pointer-events-none"
  style={{ top: timeToPosition(now, hourHeight) }}
>
  <div className="relative">
    <div className="absolute -left-1.5 -top-1.5 size-3 rounded-full bg-destructive" />
    <div className="h-0.5 bg-destructive" />
  </div>
</div>
```

#### DnD (주간/일간)

```tsx
// onDragEnd 핸들러
function handleDragEnd(event: DragEndEvent) {
  if (!event.active || !event.delta) return
  const schedule = event.active.data.current?.schedule as ScheduleItem
  const deltaY = event.delta.y
  const minutesDelta = Math.round(deltaY / (hourHeight / 4)) * 15 // 15분 스냅
  if (minutesDelta === 0) return
  const { startAt, endAt } = moveScheduleByMinutes(schedule, minutesDelta)
  moveSchedule.mutate({ id: schedule.id, startAt, endAt })
}
```

---

### 일간 뷰 (DayView)

주간 뷰의 단일 열 버전. TimeGrid 재사용.

#### Container Query 반응형

| 범위      | 시간당 높이 | 시간 라벨 | 일정 표시                     |
| --------- | ----------- | --------- | ----------------------------- |
| < 400px   | 50px        | w-8 9px   | 제목만                        |
| 400~800px | 60px        | w-10 10px | 제목 + 시간                   |
| ≥ 800px   | 60px        | w-14 xs   | 제목 + 시간 + 설명 1줄 + 장소 |

#### 겹치는 일정

`layoutOverlappingSchedules()` 결과를 바탕으로 ScheduleBlock에 `column`/`totalColumns` 전달:

- `left: (column / totalColumns) * 100%`
- `width: (1 / totalColumns) * 100% - 2px`

---

### ScheduleFormDialog (생성/수정 겸용)

```
┌───────────────────────────────────────┐
│ 일정 추가                              │  (수정: "일정 수정")
│                                        │
│ 제목 *                                 │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ┌──┐ 종일                              │  ← Switch 컴포넌트
│ └──┘                                   │
│                                        │
│ 시작                                   │
│ [2026-03-01 📅]  [10] : [00]          │  ← DatePickerButton + 시/분 Select
│                                        │
│ 종료                                   │
│ [2026-03-01 📅]  [11] : [00]          │
│                                        │  (allDay=true → 시간 Select 숨김)
│ 장소                                   │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ 설명                                   │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ 우선순위                               │
│ [보통 ▼]                               │  ← Select
│                                        │
│ 색상                                   │
│ ○ ● ● ● ● ● ● ●                      │  ← ColorPicker
│                                        │
│               [취소]  [저장]           │
└───────────────────────────────────────┘
```

#### Zod 스키마 (v4)

```typescript
import { z } from 'zod'

const scheduleFormSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(200),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  allDay: z.boolean().default(false),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  color: z.string().nullable().optional()
})
// startDate, endDate, startHour, startMinute, endHour, endMinute는
// CreateTodoDialog 패턴과 동일하게 별도 useState로 관리 (zod schema 외부)
```

#### Form + 날짜/시간 관리

```typescript
const [startDate, setStartDate] = useState<Date | null>(defaultStartDate)
const [endDate, setEndDate] = useState<Date | null>(defaultEndDate)
const [startHour, setStartHour] = useState(defaultStartDate?.getHours() ?? 9)
const [startMinute, setStartMinute] = useState(0)
const [endHour, setEndHour] = useState(defaultEndDate?.getHours() ?? 10)
const [endMinute, setEndMinute] = useState(0)
```

- 날짜: 기존 `DatePickerButton` 재사용 (`clearable={false}`)
- 시간: `Select` 컴포넌트 (시: 0~23, 분: 0/15/30/45)
- allDay=true → 시간 Select 숨김
- `handleOpenChange(true)` → form.reset + 날짜/시간 state 초기화 (CreateTodoDialog 패턴)
- 수정 모드: `initialData` prop으로 기존 데이터 프리필
- onSubmit: zod fields + 날짜/시간 state를 합쳐서 `createSchedule.mutate()` 또는 `updateSchedule.mutate()`

#### ColorPicker

```tsx
<div className="flex flex-wrap gap-2">
  {SCHEDULE_COLOR_PRESETS.map((preset) => (
    <button
      key={preset.label}
      type="button"
      className={cn(
        'size-6 rounded-full border-2 transition-all',
        selected === preset.value ? 'border-foreground scale-110' : 'border-transparent'
      )}
      style={{ backgroundColor: preset.value ?? undefined }}
      onClick={() => onChange(preset.value)}
    >
      {preset.value === null && (
        <span className="flex items-center justify-center size-full rounded-full bg-muted text-[8px] text-muted-foreground">
          자동
        </span>
      )}
    </button>
  ))}
</div>
```

---

### DeleteScheduleDialog

기존 `DeleteTodoDialog` 패턴 (AlertDialog):

```tsx
<AlertDialog open={open} onOpenChange={onOpenChange}>
  {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>일정 삭제</AlertDialogTitle>
      <AlertDialogDescription>
        이 일정을 삭제하시겠습니까? 연결된 할 일은 삭제되지 않습니다. 이 작업은 되돌릴 수 없습니다.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>취소</AlertDialogCancel>
      <AlertDialogAction onClick={() => removeSchedule.mutate({ workspaceId, scheduleId })}>
        삭제
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- controlled (`open` + `onOpenChange`) 및 trigger 방식 모두 지원

---

### ScheduleDetailPopover

```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>{children}</PopoverTrigger>
  <PopoverContent className="w-80 p-4" align="start">
    {/* 헤더 */}
    <div className="flex items-start gap-2 mb-3">
      <div
        className="size-3 rounded-full mt-1 shrink-0"
        style={{ backgroundColor: getScheduleColor(schedule) }}
      />
      <h4 className="font-semibold text-sm">{schedule.title}</h4>
    </div>

    {/* 상세 정보 */}
    <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
      <div className="flex items-center gap-2">
        <CalendarIcon className="size-3.5" />
        <span>{formatScheduleDate(schedule)}</span>
      </div>
      {!schedule.allDay && (
        <div className="flex items-center gap-2">
          <Clock className="size-3.5" />
          <span>
            {format(schedule.startAt, 'HH:mm')} - {format(schedule.endAt, 'HH:mm')}
          </span>
        </div>
      )}
      {schedule.location && (
        <div className="flex items-center gap-2">
          <MapPin className="size-3.5" />
          <span>{schedule.location}</span>
        </div>
      )}
      {schedule.description && (
        <div className="flex items-start gap-2">
          <FileText className="size-3.5 mt-0.5" />
          <span className="line-clamp-2">{schedule.description}</span>
        </div>
      )}
    </div>

    <Separator className="my-2" />
    <LinkedTodoList scheduleId={schedule.id} compact />
    <Separator className="my-2" />

    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={openEdit}>
        수정
      </Button>
      <Button variant="destructive" size="sm" onClick={openDelete}>
        삭제
      </Button>
    </div>
  </PopoverContent>
</Popover>
```

---

### LinkedTodoList + TodoLinkPopover

**LinkedTodoList:**

```tsx
interface Props {
  scheduleId: string
  compact?: boolean  // compact: Popover 내부 (최대 3개), full: Dialog 내부
}

// 각 Todo 항목
<div className="flex items-center gap-2 py-1">
  <Checkbox checked={todo.isDone} disabled className="size-3.5" />
  <span className={cn('text-xs truncate flex-1', todo.isDone && 'line-through text-muted-foreground')}>
    {todo.title}
  </span>
  <Button variant="ghost" size="icon-xs" onClick={() => unlinkTodo.mutate({ scheduleId, todoId: todo.id })}>
    <X className="size-3" />
  </Button>
</div>

// 연결 추가 버튼
<TodoLinkPopover scheduleId={scheduleId} linkedTodoIds={linkedTodoIds}>
  <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
    <Plus className="size-3.5 mr-1" /> 할 일 연결
  </Button>
</TodoLinkPopover>
```

**TodoLinkPopover:**

```tsx
<Popover>
  <PopoverTrigger asChild>{children}</PopoverTrigger>
  <PopoverContent className="w-64 p-2" align="start">
    <Input placeholder="할 일 검색..." value={search} onChange={...} className="mb-2 h-8" />
    <ScrollArea className="max-h-40">
      {filteredTodos.map(todo => (
        <button
          key={todo.id}
          className="flex items-center gap-2 w-full p-1.5 rounded hover:bg-accent text-xs text-left"
          onClick={() => linkTodo.mutate({ scheduleId, todoId: todo.id })}
          disabled={linkedTodoIds.includes(todo.id)}
        >
          <Check className={cn('size-3.5', linkedTodoIds.includes(todo.id) ? 'opacity-100' : 'opacity-0')} />
          <span className="truncate">{todo.title}</span>
        </button>
      ))}
    </ScrollArea>
  </PopoverContent>
</Popover>
```

- `useTodosByWorkspace(workspaceId)` 로 전체 Todo 조회
- `search` state로 클라이언트 필터링
- 이미 연결된 Todo는 `disabled` + Check 아이콘 표시

---

## React Query Hooks (entities/schedule/model/queries.ts)

기존 `entities/todo/model/queries.ts` 패턴을 **정확히** 따른다.

```typescript
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { throwIpcError } from '@shared/lib/ipc-error'
import type { IpcResponse } from '@shared/types/ipc'
import type { ScheduleItem, CreateScheduleData, UpdateScheduleData, ScheduleDateRange } from './types'

const SCHEDULE_KEY = 'schedule'

// 범위 조회 — queryKey에 range를 ISO string으로 포함
export function useSchedulesByWorkspace(
  workspaceId: string | null | undefined,
  range: ScheduleDateRange
): UseQueryResult<ScheduleItem[]> {
  return useQuery({
    queryKey: [SCHEDULE_KEY, 'workspace', workspaceId, range.start.toISOString(), range.end.toISOString()],
    queryFn: async (): Promise<ScheduleItem[]> => {
      const res: IpcResponse<ScheduleItem[]> = await window.api.schedule.findByWorkspace(workspaceId!, range)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!workspaceId,
  })
}

// 단건 조회
export function useScheduleById(scheduleId: string | undefined): UseQueryResult<ScheduleItem> { ... }

// 생성 — onSuccess: invalidateQueries prefix [SCHEDULE_KEY, 'workspace', workspaceId]
export function useCreateSchedule(): UseMutationResult<...> { ... }

// 수정
export function useUpdateSchedule(): UseMutationResult<...> { ... }

// 삭제
export function useRemoveSchedule(): UseMutationResult<...> { ... }

// DnD 이동 — invalidateQueries (optimistic update 미사용, 기존 패턴 준수)
export function useMoveSchedule(): UseMutationResult<...> { ... }

// Todo 연결
export function useLinkTodo(): UseMutationResult<...> { ... }

// Todo 연결 해제
export function useUnlinkTodo(): UseMutationResult<...> { ... }

// 연결된 Todo 조회
export function useLinkedTodos(scheduleId: string | undefined): UseQueryResult<TodoItem[]> {
  return useQuery({
    queryKey: [SCHEDULE_KEY, 'linkedTodos', scheduleId],
    queryFn: async () => {
      const res = await window.api.schedule.getLinkedTodos(scheduleId!)
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!scheduleId,
  })
}
```

> **Optimistic update 미사용**: 기존 프로젝트의 모든 mutation이 `invalidateQueries` 패턴. 일관성을 위해 동일하게 적용. DnD 응답이 느릴 경우 추후 optimistic update 추가 고려.

---

## 구현 범위 (Implementation Scope)

### [0단계] DB 스키마

1. `src/main/db/schema/schedule.ts` — schedules 테이블
2. `src/main/db/schema/schedule-todo.ts` — schedule_todos 연결 테이블 (복합 PK)
3. `src/main/db/schema/index.ts` — `schedules`, `scheduleTodos` export 추가
4. `npm run db:generate && npm run db:migrate`

### [1단계] Main Process

5. `src/main/repositories/schedule.ts` — CRUD + 범위 조회
6. `src/main/repositories/schedule-todo.ts` — link/unlink/findByScheduleId
7. `src/main/services/schedule.ts` — 비즈니스 로직
8. `src/main/ipc/schedule.ts` — `registerScheduleHandlers()` (9채널)
9. `src/main/index.ts` — `registerScheduleHandlers()` 호출 추가

### [2단계] Preload Bridge

10. `src/preload/index.ts` — `schedule: { ... }` 네임스페이스 추가
11. `src/preload/index.d.ts` — ScheduleItem, ScheduleAPI 등 타입 + `API.schedule` 추가

### [3단계] entities/schedule

12. `src/renderer/src/entities/schedule/model/types.ts`
13. `src/renderer/src/entities/schedule/model/queries.ts` — 9개 hooks
14. `src/renderer/src/entities/schedule/index.ts`

### [4단계] 유틸 + 모델

15. `calendar-utils.ts` — 날짜 유틸 (getMonthGrid, getWeekDates, timeToPosition, layoutOverlappingSchedules, splitBarByWeeks 등)
16. `use-calendar.ts` — 캘린더 상태 훅
17. `schedule-color.ts` — 색상 프리셋

### [5단계] 공통 UI 컴포넌트

18. `CalendarNavigation.tsx` — 오늘/이전/다음 네비게이션
19. `ScheduleFormDialog.tsx` — 생성/수정 Dialog
20. `DeleteScheduleDialog.tsx` — 삭제 AlertDialog
21. `ScheduleDetailPopover.tsx` — 상세 Popover
22. `ColorPicker.tsx` — 색상 선택기
23. `LinkedTodoList.tsx` — 연결 Todo 목록
24. `TodoLinkPopover.tsx` — Todo 연결 Popover
25. `CurrentTimeIndicator.tsx` — 현재 시각 선
26. `TimeGrid.tsx` — 시간 그리드 (주/일 공용)
27. `ScheduleBlock.tsx` — 시간 일정 블록 (draggable)
28. `ScheduleBar.tsx` — 종일/여러날 바 (draggable)
29. `ScheduleDot.tsx` — 소형 도트
30. `MonthDayCell.tsx` — 월간 날짜 셀 (droppable)

### [6단계] 월간 뷰

31. `MonthView.tsx` — DndContext + 그리드 + 바 렌더링 + 반응형

### [7단계] 주간 뷰

32. `WeekView.tsx` — DndContext + TimeGrid + 7열/1열 반응형

### [8단계] 일간 뷰

33. `DayView.tsx` — DndContext + TimeGrid + 겹침 레이아웃

### [9단계] widgets + pages + 라우팅

34. `widgets/calendar/ui/CalendarViewToolbar.tsx`
35. `widgets/calendar/index.ts`
36. `pages/calendar/ui/CalendarPage.tsx`
37. `pages/calendar/index.ts`
38. `app/layout/model/pane-routes.tsx` — CalendarPage 라우트 추가

### [10단계] Todo 연결

39. LinkedTodoList, TodoLinkPopover 실제 연결 동작 통합

---

## 구현 우선순위

```
[0단계] DB 스키마 + 마이그레이션
[1단계] Main Process (repository → service → ipc → 등록)
[2단계] Preload Bridge (index.ts 구현 + index.d.ts 타입)
[3단계] entities/schedule (React Query hooks)
[4단계] 유틸 + 모델 (calendar-utils, use-calendar, schedule-color)
[5단계] 공통 UI (Dialog, Popover, TimeGrid, ScheduleBlock 등)
[6단계] 월간 뷰 (MonthView + ScheduleBar + MonthDayCell + DnD)
[7단계] 주간 뷰 (WeekView + TimeGrid + ScheduleBlock + DnD + CurrentTimeIndicator)
[8단계] 일간 뷰 (DayView + 겹침 레이아웃 + DnD)
[9단계] CalendarViewToolbar + CalendarPage + 라우팅 연결
[10단계] Todo 연결 (LinkedTodoList + TodoLinkPopover)
```

---

## 주의사항 / 기존 패턴과의 차이

| 항목                   | 기존 프로젝트                                         | Schedule 신규                                              |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| 복합 PK                | 사용 없음 (모든 테이블 단일 PK)                       | `schedule_todos`에서 첫 도입                               |
| `date-fns` import      | `format` 1개만 사용                                   | 15+ 함수 추가 (`addDays`, `startOfMonth` 등)               |
| DnD 방식               | `useSortable` + `SortableContext`                     | `useDraggable` + `useDroppable` (셀 간 이동)               |
| Optimistic update      | 미사용 (전부 `invalidateQueries`)                     | 동일 (미사용, 일관성 유지)                                 |
| `@dnd-kit/utilities`   | 미설치 (`@dnd-kit/core` + `sortable` + `modifiers`만) | 추가 설치 불필요 (`useDraggable`의 `transform` 직접 사용)  |
| Zod version            | v4 (`^4.3.6`)                                         | 동일 v4 사용                                               |
| CalendarViewToolbar    | —                                                     | `TodoViewToolbar` 패턴 확장 (ToggleGroup + Dialog trigger) |
| tabSearchParams 동기화 | view, filter, section open/close 저장                 | viewType, currentDate 저장                                 |

---

## Success Criteria

- [ ] Schedule CRUD (생성/조회/수정/삭제) 정상 동작
- [ ] workspaceId cascade delete: 워크스페이스 삭제 시 일정 전체 삭제
- [ ] schedule_todos cascade: 일정/Todo 삭제 시 연결만 삭제 (원본 유지)
- [ ] 날짜 범위 조회: `startAt <= range.end AND endAt >= range.start` 정확
- [ ] allDay 종일 일정: 시간 자동 보정 (00:00:00.000 / 23:59:59.999)
- [ ] `startAt <= endAt` 서비스 검증 (ValidationError)
- [ ] **월간 뷰**
  - [ ] 7x5~6 그리드 (이전/다음 월 날짜 muted)
  - [ ] 오늘: primary 원형 배경
  - [ ] 날짜 클릭: selected ring 스타일
  - [ ] < 400px: 도트 + 하단 목록
  - [ ] 400~800px: 제목 1줄 (최대 3개 + 더보기)
  - [ ] ≥ 800px: 시간 + 제목 (최대 4개 + 더보기)
  - [ ] 여러 날 바: 주(row) 경계 분할, lane 배치
  - [ ] DnD: 날짜 이동 (duration 유지)
- [ ] **주간 뷰**
  - [ ] < 400px: 일간 뷰 위임 + 날짜 선택 바
  - [ ] 400~800px: 7열, 40px/h
  - [ ] ≥ 800px: 7열, 60px/h
  - [ ] 종일 일정 상단 별도 영역
  - [ ] 시간 블록 정확한 높이/위치
  - [ ] CurrentTimeIndicator (1분 갱신)
  - [ ] DnD: 15분 스냅 시간/날짜 이동
  - [ ] 초기 스크롤: 현재 시각 또는 08:00
- [ ] **일간 뷰**
  - [ ] 반응형 시간 라벨/일정 상세 수준
  - [ ] 겹치는 일정 수평 분할 (layoutOverlappingSchedules)
  - [ ] 빈 시간 클릭 → ScheduleFormDialog (startAt 사전 설정)
  - [ ] DnD: 세로 시간 이동 (15분 스냅)
- [ ] ScheduleFormDialog: 생성/수정 겸용, allDay 토글, DatePickerButton, 시간 Select, ColorPicker
- [ ] DeleteScheduleDialog: AlertDialog 패턴
- [ ] ScheduleDetailPopover: 상세 + 수정/삭제 진입
- [ ] CalendarNavigation: 오늘/이전/다음
- [ ] CalendarViewToolbar: ToggleGroup 뷰 전환 + 일정 추가
- [ ] tabSearchParams: viewType, currentDate 탭 복원
- [ ] workspaceId null → "워크스페이스를 선택해주세요" 안내
- [ ] **Todo 연결**
  - [ ] LinkedTodoList: 표시 + 해제
  - [ ] TodoLinkPopover: 검색 + 연결
  - [ ] N:M 정상 동작
- [ ] FSD Import 규칙 준수
- [ ] TypeScript 컴파일 에러 없음
- [ ] Container query 전용 (@[400px], @[800px]), viewport query 미사용
- [ ] shadcn/ui + 디자인 토큰 일관성
