# Design: Calendar 리팩토링

> Plan 참조: `docs/01-plan/features/calendar-refactor.plan.md`

---

## 0. 구현 우선순위

```
[Phase 1] 상수 & 유틸리티 분리
  1-1. model/calendar-constants.ts (신규)
  1-2. model/calendar-predicates.ts (신규)
  1-3. model/calendar-grid.ts (신규)
  1-4. model/calendar-layout.ts (신규)
  1-5. model/calendar-time.ts (신규)
  1-6. model/calendar-move.ts (신규)
  1-7. model/calendar-utils.ts → re-export barrel 전환

[Phase 2] 공통 로직 추출
  2-1. model/schedule-style.ts (신규)
  2-2. ui/ScheduleBarItem.tsx (신규)
  2-3. ui/WeekDayCell.tsx (신규)
  2-4. model/use-day-dnd.ts (신규)
  2-5. model/use-schedule-resize.ts (신규)

[Phase 3] 뷰 리팩토링
  3-1. ui/MonthView.tsx (수정: 524→~430)
  3-2. ui/WeekView.tsx (수정: 553→~358)
  3-3. ui/DayView.tsx (수정: 355→~180)

[Phase 4] 마무리
  4-1. index.ts barrel export 업데이트
  4-2. npm run typecheck + npm run lint
  4-3. 사이드 이펙트 방지 체크리스트 수동 검증
```

---

## 1. Phase 1: 상수 & 유틸리티 분리

모든 파일 경로: `src/renderer/src/features/schedule/manage-schedule/model/`

### 1-1. `calendar-constants.ts` (신규, ~12줄)

```typescript
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

export const MONTH_BAR_HEIGHT = 18
export const WEEK_BAR_HEIGHT = 20
export const BAR_GAP = 2
export const HOUR_HEIGHT = 60
export const START_HOUR = 6

export const DND_ACTIVATION_CONSTRAINT = { delay: 200, tolerance: 5 } as const
```

> **출처**: MonthView:39-41 (`WEEKDAY_LABELS`, `BAR_HEIGHT=18`, `BAR_GAP=2`), WeekView:32-34 (`WEEKDAY_LABELS`, `BAR_HEIGHT=20`, `BAR_GAP=2`), DayView:212 (`hourHeight=60`), calendar-utils:78 (`START_HOUR=6`), 3개 뷰 공통 (`delay:200, tolerance:5`)

### 1-2. `calendar-predicates.ts` (신규, ~15줄)

```typescript
import { startOfDay, endOfDay } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'

export function isTodoItem(schedule: ScheduleItem): boolean {
  return schedule.id.startsWith('todo:')
}

export function isScheduleOnDate(schedule: ScheduleItem, date: Date): boolean {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  return schedule.startAt <= dayEnd && schedule.endAt >= dayStart
}
```

> **출처**: calendar-utils.ts:225-227, 97-101 — 변경 없이 이동

### 1-3. `calendar-grid.ts` (신규, ~40줄)

```typescript
import {
  addDays,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  isSameDay
} from 'date-fns'

export interface MonthGridDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
}

export function getMonthGrid(year: number, month: number): MonthGridDay[][] {
  const today = startOfDay(new Date())
  const firstDay = new Date(year, month, 1)
  const monthStart = startOfWeek(firstDay)
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

export function getWeekDates(date: Date): Date[] {
  const weekStart = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}
```

> **출처**: calendar-utils.ts:16-20, 44-67, 71-74 — 변경 없이 이동

### 1-4. `calendar-layout.ts` (신규, ~160줄)

```typescript
import {
  isSameDay,
  differenceInCalendarDays,
  startOfDay,
  endOfDay,
  getDay
} from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import type { MonthGridDay } from './calendar-grid'

// === 타입 ===

export interface LayoutedSchedule {
  schedule: ScheduleItem
  column: number
  totalColumns: number
  span: number
}

export interface WeekBarSegment {
  weekIndex: number
  startCol: number
  span: number
  isStart: boolean
  isEnd: boolean
}

export interface WeekBar {
  schedule: ScheduleItem
  startCol: number
  span: number
  isStart: boolean
  isEnd: boolean
  lane: number
}

// === 제네릭 lane 할당 ===

/**
 * greedy lane 할당 알고리즘
 * startCol 오름차순, span 내림차순으로 정렬 후 비어있는 lane에 배치
 *
 * MonthView: { ...WeekBarSegment, schedule } 입력
 * WeekView: computeWeekBars 내부에서 호출
 */
export function assignLanes<T extends { startCol: number; span: number }>(
  items: T[]
): (T & { lane: number })[] {
  const sorted = [...items].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol
    return b.span - a.span
  })

  const lanes: { endCol: number }[] = []
  const result: (T & { lane: number })[] = []

  for (const item of sorted) {
    let lane = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].endCol <= item.startCol) {
        lane = i
        lanes[i].endCol = item.startCol + item.span
        break
      }
    }
    if (lane === -1) {
      lane = lanes.length
      lanes.push({ endCol: item.startCol + item.span })
    }
    result.push({ ...item, lane })
  }

  return result
}

// === 월간 바 분할 ===

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

    const startCol = getDay(effectiveStart)
    const daysDiff = Math.floor(
      (startOfDay(effectiveEnd).getTime() - startOfDay(effectiveStart).getTime()) /
        (1000 * 60 * 60 * 24)
    )

    segments.push({
      weekIndex: weekIdx,
      startCol,
      span: daysDiff + 1,
      isStart: isSameDay(effectiveStart, schedule.startAt),
      isEnd: isSameDay(effectiveEnd, schedule.endAt)
    })
  }

  return segments
}

// === 주간 바 계산 (assignLanes 사용) ===

export function computeWeekBars(multiDay: ScheduleItem[], weekDates: Date[]): WeekBar[] {
  const weekStart = startOfDay(weekDates[0])
  const weekEnd = endOfDay(weekDates[6])

  const items: Omit<WeekBar, 'lane'>[] = []

  for (const s of multiDay) {
    if (s.startAt > weekEnd || s.endAt < weekStart) continue

    const effectiveStart = s.startAt < weekStart ? weekStart : s.startAt
    const effectiveEnd = s.endAt > weekEnd ? weekEnd : s.endAt

    const startCol = getDay(effectiveStart)
    const span = differenceInCalendarDays(startOfDay(effectiveEnd), startOfDay(effectiveStart)) + 1

    items.push({
      schedule: s,
      startCol,
      span,
      isStart: isSameDay(effectiveStart, s.startAt),
      isEnd: isSameDay(effectiveEnd, s.endAt)
    })
  }

  return assignLanes(items)
}

// === 겹침 레이아웃 (일간/주간) ===

export function layoutOverlappingSchedules(
  schedules: ScheduleItem[]
): LayoutedSchedule[] {
  if (schedules.length === 0) return []

  const sorted = [...schedules].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime()
  )

  // 1) 열 할당: greedy
  const assigned: { schedule: ScheduleItem; column: number }[] = []
  const columnEnds: Date[] = []

  for (const schedule of sorted) {
    let col = -1
    for (let i = 0; i < columnEnds.length; i++) {
      if (schedule.startAt >= columnEnds[i]) {
        col = i
        columnEnds[i] = schedule.endAt
        break
      }
    }
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(schedule.endAt)
    }
    assigned.push({ schedule, column: col })
  }

  const n = assigned.length

  // 2) 클러스터(연결 요소) — union-find
  const parent = Array.from({ length: n }, (_, i) => i)
  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x])
    return parent[x]
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (
        assigned[i].schedule.startAt < assigned[j].schedule.endAt &&
        assigned[j].schedule.startAt < assigned[i].schedule.endAt
      ) {
        parent[find(i)] = find(j)
      }
    }
  }

  // 3) 클러스터별 최대 열 → totalColumns
  const clusterMaxCol = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    const cur = clusterMaxCol.get(root) ?? 0
    if (assigned[i].column > cur) clusterMaxCol.set(root, assigned[i].column)
  }

  // 4) 각 스케줄의 span: 오른쪽 빈 열로 확장
  return assigned.map(({ schedule, column }, idx) => {
    const totalColumns = (clusterMaxCol.get(find(idx)) ?? 0) + 1

    let span = 1
    for (let nextCol = column + 1; nextCol < totalColumns; nextCol++) {
      let occupied = false
      for (let j = 0; j < n; j++) {
        if (j === idx) continue
        if (
          assigned[j].column === nextCol &&
          assigned[j].schedule.startAt < schedule.endAt &&
          schedule.startAt < assigned[j].schedule.endAt
        ) {
          occupied = true
          break
        }
      }
      if (occupied) break
      span++
    }

    return { schedule, column, totalColumns, span }
  })
}
```

> **출처**:
> - `assignLanes`: MonthView:48-76 → 제네릭화 (`T extends { startCol, span }`)
> - `splitBarByWeeks`: calendar-utils.ts:105-137 — 변경 없이 이동
> - `computeWeekBars`: WeekView:45-94 → 내부 lane 할당을 `assignLanes()` 호출로 교체
> - `layoutOverlappingSchedules`: calendar-utils.ts:141-221 — 변경 없이 이동

### 1-5. `calendar-time.ts` (신규, ~25줄)

```typescript
import { differenceInMinutes } from 'date-fns'
import { START_HOUR } from './calendar-constants'

export interface TimeSlot {
  hour: number
  label: string
}

export function getTimeSlots(): TimeSlot[] {
  return Array.from({ length: 24 - START_HOUR }, (_, i) => ({
    hour: START_HOUR + i,
    label: `${String(START_HOUR + i).padStart(2, '0')}:00`
  }))
}

export function timeToPosition(date: Date, hourHeight: number): number {
  return (date.getHours() - START_HOUR + date.getMinutes() / 60) * hourHeight
}

export function scheduleHeight(startAt: Date, endAt: Date, hourHeight: number): number {
  return Math.max((differenceInMinutes(endAt, startAt) / 60) * hourHeight, 20)
}
```

> **출처**: calendar-utils.ts:22-25, 78-93 — `START_HOUR`를 `calendar-constants`에서 import로 변경

### 1-6. `calendar-move.ts` (신규, ~50줄)

```typescript
import { addDays } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import { isTodoItem } from './calendar-predicates'

export function moveScheduleByDays(
  schedule: ScheduleItem,
  daysDelta: number
): { startAt: Date; endAt: Date } {
  return {
    startAt: addDays(schedule.startAt, daysDelta),
    endAt: addDays(schedule.endAt, daysDelta)
  }
}

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

/**
 * 날짜(days) 기반 이동 mutation 실행
 * MonthView/WeekView handleDragEnd 공용
 *
 * Hook이 아닌 순수 함수 — mutation 인스턴스는 호출측에서 주입
 */
export function applyDaysDelta(
  schedule: ScheduleItem,
  daysDelta: number,
  callbacks: {
    onMoveSchedule: (id: string, startAt: Date, endAt: Date) => void
    onMoveTodo: (todoId: string, startDate: Date, dueDate: Date) => void
  }
): void {
  if (daysDelta === 0) return
  const msOffset = daysDelta * 86400000

  if (isTodoItem(schedule)) {
    callbacks.onMoveTodo(
      schedule.id.slice(5),
      new Date(schedule.startAt.getTime() + msOffset),
      new Date(schedule.endAt.getTime() + msOffset)
    )
  } else {
    callbacks.onMoveSchedule(
      schedule.id,
      new Date(schedule.startAt.getTime() + msOffset),
      new Date(schedule.endAt.getTime() + msOffset)
    )
  }
}
```

> **출처**:
> - `moveScheduleByDays/Minutes`: calendar-utils.ts:231-251 — 변경 없이 이동
> - `applyDaysDelta`: MonthView:158-174, WeekView:171-187 공통 mutation 패턴 추출 (신규)

### 1-7. `calendar-utils.ts` (기존 → re-export barrel, ~10줄)

기존 252줄 → re-export barrel로 전환. 모든 import 경로 호환 유지.

```typescript
export * from './calendar-constants'
export * from './calendar-predicates'
export * from './calendar-grid'
export * from './calendar-layout'
export * from './calendar-time'
export * from './calendar-move'
```

> **주의**: feature barrel(`index.ts`)이 `from './model/calendar-utils'`에서 named export로 가져오므로, re-export barrel을 통해 모든 기존 export가 동일 경로에서 접근 가능. 외부 소비자 import 깨짐 없음.

---

## 2. Phase 2: 공통 로직 추출

### 2-1. `model/schedule-style.ts` (신규, ~25줄)

```typescript
import type { ScheduleItem } from '@entities/schedule'
import { isTodoItem } from './calendar-predicates'
import { getScheduleColor } from './schedule-color'

/** 일정 아이템 배경 스타일 (블록/바/셀 아이템 공용) */
export function getItemStyle(schedule: ScheduleItem): {
  backgroundColor: string
  border: string | undefined
  color: string
} {
  const color = getScheduleColor(schedule)
  const isTodo = isTodoItem(schedule)
  return {
    backgroundColor: isTodo ? 'transparent' : `${color}20`,
    border: isTodo ? `1px solid ${color}50` : undefined,
    color
  }
}

/** 일정 도트 스타일 (소형 리스트 뷰) */
export function getItemDotStyle(schedule: ScheduleItem): {
  backgroundColor: string
  border: string | undefined
} {
  const color = getScheduleColor(schedule)
  const isTodo = isTodoItem(schedule)
  return {
    backgroundColor: isTodo ? 'transparent' : color,
    border: isTodo ? `1.5px solid ${color}` : undefined
  }
}
```

> **출처**: MonthView CellContent:464-466, WeekDayCell:452-454, DayView allDay:232-234, SelectedDateList:505-507, SmallDayList:533-534 — 10회+ 반복 패턴

### 2-2. `ui/ScheduleBarItem.tsx` (신규, ~65줄)

MonthBarItem(66줄) + WeekBarItem(62줄) → 통합 ~65줄

```typescript
import { useDraggable } from '@dnd-kit/core'
import type { ScheduleItem } from '@entities/schedule'
import { BAR_GAP } from '../model/calendar-constants'
import { getItemStyle } from '../model/schedule-style'
import { isTodoItem } from '../model/calendar-predicates'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'

interface Props {
  schedule: ScheduleItem
  workspaceId: string
  startCol: number
  span: number
  lane: number
  isStart: boolean
  isEnd: boolean
  barHeight: number
  draggableId: string
  draggableData?: Record<string, unknown>
  onGrab: (offset: number, width?: number) => void
  wrapperClassName?: string
}

export function ScheduleBarItem({
  schedule,
  workspaceId,
  startCol,
  span,
  lane,
  isStart,
  isEnd,
  barHeight,
  draggableId,
  draggableData,
  onGrab,
  wrapperClassName
}: Props): React.JSX.Element {
  const style = getItemStyle(schedule)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableId,
    data: { schedule, type: 'bar', ...draggableData }
  })

  function handlePointerDown(e: React.PointerEvent): void {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const colWidth = rect.width / span
    const offset = Math.floor(clickX / colWidth)
    onGrab(offset, rect.width)
    ;(listeners as Record<string, (e: React.PointerEvent) => void>)?.onPointerDown?.(e)
  }

  const inner = (
    <ScheduleDetailPopover schedule={schedule} workspaceId={workspaceId}>
      <div
        ref={setNodeRef}
        {...attributes}
        onPointerDown={handlePointerDown}
        className={`absolute cursor-pointer text-[10px] px-1 truncate ${
          isStart ? 'rounded-l-sm' : ''
        } ${isEnd ? 'rounded-r-sm' : ''}`}
        style={{
          lineHeight: `${barHeight}px`,
          top: lane * (barHeight + BAR_GAP),
          left: `${(startCol / 7) * 100}%`,
          width: `${(span / 7) * 100}%`,
          height: barHeight,
          ...style,
          opacity: isDragging ? 0.4 : 1
        }}
      >
        {isTodoItem(schedule) && <span className="opacity-60 mr-0.5">☑</span>}
        {schedule.title}
      </div>
    </ScheduleDetailPopover>
  )

  return wrapperClassName ? <div className={wrapperClassName}>{inner}</div> : inner
}
```

> **MonthView 사용**:
> ```tsx
> <ScheduleBarItem
>   schedule={ls.schedule}
>   workspaceId={workspaceId}
>   startCol={ls.startCol} span={ls.span} lane={ls.lane}
>   isStart={ls.isStart} isEnd={ls.isEnd}
>   barHeight={MONTH_BAR_HEIGHT}
>   draggableId={`bar-${ls.schedule.id}-w${weekIdx}`}
>   onGrab={(offset) => { /* 기존 로직 */ }}
>   wrapperClassName="pointer-events-auto"
> />
> ```
>
> **WeekView 사용**:
> ```tsx
> <ScheduleBarItem
>   schedule={bar.schedule}
>   workspaceId={workspaceId}
>   startCol={bar.startCol} span={bar.span} lane={bar.lane}
>   isStart={bar.isStart} isEnd={bar.isEnd}
>   barHeight={WEEK_BAR_HEIGHT}
>   draggableId={`week-bar-${bar.schedule.id}`}
>   draggableData={{ span: bar.span }}
>   onGrab={(offset, width) => { /* 기존 로직 */ }}
> />
> ```

### 2-3. `ui/WeekDayCell.tsx` (신규, ~85줄)

WeekDayCell(65줄) + DraggableScheduleItem(18줄) co-locate

```typescript
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { format } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import { isScheduleOnDate, isTodoItem } from '../model/calendar-predicates'
import { getScheduleColor } from '../model/schedule-color'
import { getItemStyle } from '../model/schedule-style'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'

interface Props {
  date: Date
  dayIdx: number
  schedules: ScheduleItem[]
  workspaceId: string
  barAreaHeight: number
  activeSchedule: ScheduleItem | null
}

export function WeekDayCell({
  date,
  dayIdx,
  schedules,
  workspaceId,
  barAreaHeight,
  activeSchedule
}: Props): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: `week-cell-${dayIdx}`,
    data: { date }
  })

  const daySchedules = schedules.filter((s) => isScheduleOnDate(s, date))

  return (
    <div
      ref={setNodeRef}
      className={`border-r border-border p-1 space-y-0.5 ${isOver ? 'bg-accent/30' : ''}`}
      style={{ paddingTop: barAreaHeight > 0 ? barAreaHeight + 4 : undefined }}
    >
      {daySchedules.map((s) => (
        <DraggableScheduleItem key={s.id} schedule={s}>
          <ScheduleDetailPopover schedule={s} workspaceId={workspaceId}>
            <div
              className="text-[10px] @[800px]:text-[11px] truncate rounded px-1 py-px cursor-pointer"
              style={getItemStyle(s)}
            >
              {isTodoItem(s) && <span className="opacity-60 mr-0.5">☑</span>}
              {!s.allDay && (
                <span className="hidden @[800px]:inline">{format(s.startAt, 'HH:mm')} </span>
              )}
              {s.title}
            </div>
          </ScheduleDetailPopover>
        </DraggableScheduleItem>
      ))}

      {/* DnD drop preview */}
      {isOver && activeSchedule && (
        <div
          className="text-[10px] truncate rounded px-1 py-px pointer-events-none"
          style={{
            backgroundColor: `${getScheduleColor(activeSchedule)}15`,
            border: `1.5px dashed ${getScheduleColor(activeSchedule)}60`,
            color: getScheduleColor(activeSchedule)
          }}
        >
          {activeSchedule.title}
        </div>
      )}
    </div>
  )
}

// DraggableScheduleItem — WeekDayCell 전용 (co-locate)
function DraggableScheduleItem({
  schedule,
  children
}: {
  schedule: ScheduleItem
  children: React.ReactNode
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `week-single-${schedule.id}`,
    data: { schedule, type: 'single' }
  })

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {children}
    </div>
  )
}
```

> **출처**: WeekView:418-482 (WeekDayCell) + 484-502 (DraggableScheduleItem) — inline style → `getItemStyle` 적용

### 2-4. `model/use-day-dnd.ts` (신규, ~80줄)

DayView DnD 상태 4개 + 핸들러 3개 캡슐화

```typescript
import { useState } from 'react'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import type { ScheduleItem } from '@entities/schedule'
import { isTodoItem } from './calendar-predicates'
import type { DragItemType } from '../ui/ScheduleDragOverlay'

interface UseDayDndOptions {
  workspaceId: string
  hourHeight: number
  clampMap: Map<string, { start: Date; end: Date }>
  onMoveSchedule: (params: {
    scheduleId: string
    startAt: Date
    endAt: Date
    workspaceId: string
  }) => void
  onMoveTodo: (params: {
    workspaceId: string
    todoId: string
    data: { startDate: Date; dueDate: Date }
  }) => void
}

interface UseDayDndReturn {
  activeSchedule: ScheduleItem | null
  activeType: DragItemType
  previewDelta: number
  activeSize: { width: number; height: number } | undefined
  handleDragStart: (event: DragStartEvent) => void
  handleDragMove: (event: DragMoveEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
}

export function useDayDnd(options: UseDayDndOptions): UseDayDndReturn {
  const { workspaceId, hourHeight, clampMap, onMoveSchedule, onMoveTodo } = options

  const [activeSchedule, setActiveSchedule] = useState<ScheduleItem | null>(null)
  const [activeType, setActiveType] = useState<DragItemType>('block')
  const [previewDelta, setPreviewDelta] = useState(0)
  const [activeSize, setActiveSize] = useState<{ width: number; height: number } | undefined>()

  function handleDragStart(event: DragStartEvent): void {
    const schedule = event.active.data.current?.schedule as ScheduleItem | undefined
    setActiveSchedule(schedule ?? null)
    setActiveType((event.active.data.current?.type as DragItemType) ?? 'block')

    const el = (event.activatorEvent.target as HTMLElement)?.closest?.(
      '[data-block-id]'
    ) as HTMLElement | null
    if (el) {
      setActiveSize({ width: el.offsetWidth, height: el.offsetHeight })
    }
  }

  function handleDragMove(event: DragMoveEvent): void {
    const minutesDelta = Math.round(((event.delta.y / hourHeight) * 60) / 15) * 15
    setPreviewDelta(minutesDelta)
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveSchedule(null)
    setPreviewDelta(0)
    const schedule = event.active.data.current?.schedule as ScheduleItem | undefined
    if (!schedule) return

    const minutesDelta = Math.round(((event.delta.y / hourHeight) * 60) / 15) * 15
    if (minutesDelta === 0) return

    const msOffset = minutesDelta * 60 * 1000

    if (isTodoItem(schedule)) {
      const clamp = clampMap.get(schedule.id)
      const baseStart = clamp?.start ?? schedule.startAt
      const baseEnd = clamp?.end ?? schedule.endAt
      const movedStart = new Date(baseStart.getTime() + msOffset)
      const movedEnd = new Date(baseEnd.getTime() + msOffset)

      const newStart = new Date(schedule.startAt)
      newStart.setHours(movedStart.getHours(), movedStart.getMinutes(), 0, 0)
      const newEnd = new Date(schedule.endAt)
      newEnd.setHours(movedEnd.getHours(), movedEnd.getMinutes(), 0, 0)

      onMoveTodo({
        workspaceId,
        todoId: schedule.id.slice(5),
        data: { startDate: newStart, dueDate: newEnd }
      })
    } else {
      onMoveSchedule({
        scheduleId: schedule.id,
        startAt: new Date(schedule.startAt.getTime() + msOffset),
        endAt: new Date(schedule.endAt.getTime() + msOffset),
        workspaceId
      })
    }
  }

  return {
    activeSchedule,
    activeType,
    previewDelta,
    activeSize,
    handleDragStart,
    handleDragMove,
    handleDragEnd
  }
}
```

> **출처**: DayView:38-41 (상태) + 94-150 (핸들러)
> **변경**: `hourHeight` 로컬 재선언(line 118) 제거 → `options.hourHeight` 일관 사용

### 2-5. `model/use-schedule-resize.ts` (신규, ~70줄)

DayView resize 상태 2개 + 핸들러 1개 캡슐화

```typescript
import { useState } from 'react'
import type { ScheduleItem } from '@entities/schedule'
import { isTodoItem } from './calendar-predicates'

interface UseScheduleResizeOptions {
  workspaceId: string
  hourHeight: number
  clampMap: Map<string, { start: Date; end: Date }>
  onMoveSchedule: (params: {
    scheduleId: string
    startAt: Date
    endAt: Date
    workspaceId: string
  }) => void
  onMoveTodo: (params: {
    workspaceId: string
    todoId: string
    data: { startDate: Date; dueDate: Date }
  }) => void
}

interface UseScheduleResizeReturn {
  resizing: { schedule: ScheduleItem; edge: 'top' | 'bottom' } | null
  resizeDelta: number
  handleResizeStart: (e: React.PointerEvent, schedule: ScheduleItem, edge: 'top' | 'bottom') => void
}

export function useScheduleResize(options: UseScheduleResizeOptions): UseScheduleResizeReturn {
  const { workspaceId, hourHeight, clampMap, onMoveSchedule, onMoveTodo } = options

  const [resizing, setResizing] = useState<{
    schedule: ScheduleItem
    edge: 'top' | 'bottom'
  } | null>(null)
  const [resizeDelta, setResizeDelta] = useState(0)

  function handleResizeStart(
    e: React.PointerEvent,
    schedule: ScheduleItem,
    edge: 'top' | 'bottom'
  ): void {
    e.preventDefault()
    const startY = e.clientY
    setResizing({ schedule, edge })
    setResizeDelta(0)

    function onMove(ev: PointerEvent): void {
      const delta = Math.round((((ev.clientY - startY) / hourHeight) * 60) / 15) * 15
      setResizeDelta(delta)
    }

    function onUp(ev: PointerEvent): void {
      const delta = Math.round((((ev.clientY - startY) / hourHeight) * 60) / 15) * 15

      if (delta !== 0) {
        const msOffset = delta * 60 * 1000

        if (isTodoItem(schedule)) {
          const clamp = clampMap.get(schedule.id)
          const baseStart = clamp?.start ?? schedule.startAt
          const baseEnd = clamp?.end ?? schedule.endAt
          const movedStart = edge === 'top' ? new Date(baseStart.getTime() + msOffset) : baseStart
          const movedEnd = edge === 'bottom' ? new Date(baseEnd.getTime() + msOffset) : baseEnd

          const newStart = new Date(schedule.startAt)
          newStart.setHours(movedStart.getHours(), movedStart.getMinutes(), 0, 0)
          const newEnd = new Date(schedule.endAt)
          newEnd.setHours(movedEnd.getHours(), movedEnd.getMinutes(), 0, 0)

          onMoveTodo({
            workspaceId,
            todoId: schedule.id.slice(5),
            data: { startDate: newStart, dueDate: newEnd }
          })
        } else {
          onMoveSchedule({
            scheduleId: schedule.id,
            startAt:
              edge === 'top' ? new Date(schedule.startAt.getTime() + msOffset) : schedule.startAt,
            endAt:
              edge === 'bottom' ? new Date(schedule.endAt.getTime() + msOffset) : schedule.endAt,
            workspaceId
          })
        }
      }

      setResizing(null)
      setResizeDelta(0)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return { resizing, resizeDelta, handleResizeStart }
}
```

> **출처**: DayView:42-46 (상태) + 152-210 (핸들러) — 변경 없이 이동, `hourHeight` 참조를 `options.hourHeight`로 통일

---

## 3. Phase 3: 뷰 리팩토링

### 3-1. `ui/MonthView.tsx` (수정: 524→~430줄)

#### 제거 항목

| 제거 대상 | 줄 | 대체 |
|-----------|-----|------|
| `WEEKDAY_LABELS` 로컬 선언 | 39 | `calendar-constants` import |
| `BAR_HEIGHT`, `BAR_GAP` 로컬 선언 | 40-41 | `MONTH_BAR_HEIGHT`, `BAR_GAP` import |
| `LanedSegment` 인터페이스 | 43-46 | 불필요 (assignLanes 제네릭 반환 타입) |
| `assignLanes` 함수 | 48-76 | `calendar-layout` import |
| `MonthBarItem` 컴포넌트 | 322-388 | `ScheduleBarItem` import |
| `handleDragEnd` 내 mutation 분기 | 158-174 | `applyDaysDelta` 호출 |

#### 추가 import

```typescript
import {
  WEEKDAY_LABELS,
  MONTH_BAR_HEIGHT,
  BAR_GAP,
  DND_ACTIVATION_CONSTRAINT
} from '../model/calendar-constants'
import { assignLanes } from '../model/calendar-layout'
import { applyDaysDelta } from '../model/calendar-move'
import { getItemStyle } from '../model/schedule-style'
import { ScheduleBarItem } from './ScheduleBarItem'
```

#### 핵심 변경: `handleDragEnd`

```typescript
function handleDragEnd(event: DragEndEvent): void {
  setActiveSchedule(null)
  setOverDate(null)
  const { active, over } = event
  if (!over) return

  const schedule = active.data.current?.schedule as ScheduleItem | undefined
  if (!schedule) return

  const targetDate = over.data.current?.date as Date | undefined
  if (!targetDate) return

  const daysDelta =
    differenceInCalendarDays(targetDate, startOfDay(schedule.startAt)) - grabDayOffset

  applyDaysDelta(schedule, daysDelta, {
    onMoveSchedule: (id, start, end) =>
      moveSchedule.mutate({ scheduleId: id, startAt: start, endAt: end, workspaceId }),
    onMoveTodo: (id, start, end) =>
      updateTodo.mutate({ workspaceId, todoId: id, data: { startDate: start, dueDate: end } })
  })
}
```

#### 핵심 변경: `weekLanes` useMemo

```typescript
const weekLanes = useMemo(() => {
  const result: (WeekBarSegment & { schedule: ScheduleItem })[][] = grid.map(() => [])

  for (const schedule of multiDay) {
    const segments = splitBarByWeeks(schedule, grid)
    for (const segment of segments) {
      result[segment.weekIndex].push({ ...segment, schedule })
    }
  }

  return result.map((weekSegments) => assignLanes(weekSegments))
}, [multiDay, grid])
```

#### 핵심 변경: MonthBarItem → ScheduleBarItem

```tsx
{lanes.map((ls) => (
  <ScheduleBarItem
    key={`${ls.schedule.id}-w${weekIdx}`}
    schedule={ls.schedule}
    workspaceId={workspaceId}
    startCol={ls.startCol}
    span={ls.span}
    lane={ls.lane}
    isStart={ls.isStart}
    isEnd={ls.isEnd}
    barHeight={MONTH_BAR_HEIGHT}
    draggableId={`bar-${ls.schedule.id}-w${weekIdx}`}
    onGrab={(offset) => {
      const segDate = week[ls.startCol].date
      setGrabDayOffset(
        differenceInCalendarDays(segDate, startOfDay(ls.schedule.startAt)) + offset
      )
    }}
    wrapperClassName="pointer-events-auto"
  />
))}
```

#### 인라인 유지 (변경 없음)

- `DraggableScheduleItem` (390-410) — MonthView 스코프 유지
- `CellContent` (413-478) — inline style → `getItemStyle(s)` 적용
- `SelectedDateList` (482-523) — dot style → `getItemDotStyle(s)` 적용

### 3-2. `ui/WeekView.tsx` (수정: 553→~358줄)

#### 제거 항목

| 제거 대상 | 줄 | 대체 |
|-----------|-----|------|
| `WEEKDAY_LABELS` 로컬 선언 | 32 | `calendar-constants` import |
| `BAR_HEIGHT`, `BAR_GAP` 로컬 선언 | 33-34 | `WEEK_BAR_HEIGHT`, `BAR_GAP` import |
| `WeekBar` 인터페이스 | 36-43 | `calendar-layout` import |
| `computeWeekBars` 함수 | 45-94 | `calendar-layout` import |
| `WeekBarItem` 컴포넌트 | 354-415 | `ScheduleBarItem` import |
| `WeekDayCell` 컴포넌트 | 418-482 | `WeekDayCell.tsx` import |
| `DraggableScheduleItem` 컴포넌트 | 484-502 | `WeekDayCell.tsx`에 co-locate |
| `handleDragEnd` 내 mutation 분기 | 171-187 | `applyDaysDelta` 호출 |

#### 추가 import

```typescript
import {
  WEEKDAY_LABELS,
  WEEK_BAR_HEIGHT,
  BAR_GAP,
  DND_ACTIVATION_CONSTRAINT
} from '../model/calendar-constants'
import { computeWeekBars, type WeekBar } from '../model/calendar-layout'
import { applyDaysDelta } from '../model/calendar-move'
import { getItemDotStyle } from '../model/schedule-style'
import { ScheduleBarItem } from './ScheduleBarItem'
import { WeekDayCell } from './WeekDayCell'
```

#### 제거 import

```typescript
// 제거: useDroppable, useDraggable (WeekDayCell.tsx로 이동)
// 제거: getDay, endOfDay (computeWeekBars와 함께 이동)
```

#### 핵심 변경: `handleDragEnd`

```typescript
function handleDragEnd(event: DragEndEvent): void {
  setActiveSchedule(null)
  setOverDayIdx(null)
  const { active, over } = event
  if (!over) return

  const schedule = active.data.current?.schedule as ScheduleItem | undefined
  if (!schedule) return

  const targetDate = over.data.current?.date as Date | undefined
  if (!targetDate) return

  const daysDelta =
    differenceInCalendarDays(targetDate, startOfDay(schedule.startAt)) - grabDayOffsetRef.current

  applyDaysDelta(schedule, daysDelta, {
    onMoveSchedule: (id, start, end) =>
      moveSchedule.mutate({ scheduleId: id, startAt: start, endAt: end, workspaceId }),
    onMoveTodo: (id, start, end) =>
      updateTodo.mutate({ workspaceId, todoId: id, data: { startDate: start, dueDate: end } })
  })
}
```

#### 핵심 변경: WeekBarItem → ScheduleBarItem

```tsx
{weekBars.map((bar, i) => (
  <div key={`${bar.schedule.id}-${i}`} className="pointer-events-auto">
    <ScheduleBarItem
      schedule={bar.schedule}
      workspaceId={workspaceId}
      startCol={bar.startCol}
      span={bar.span}
      lane={bar.lane}
      isStart={bar.isStart}
      isEnd={bar.isEnd}
      barHeight={WEEK_BAR_HEIGHT}
      draggableId={`week-bar-${bar.schedule.id}`}
      draggableData={{ span: bar.span }}
      onGrab={(offset, width) => {
        const segDate = weekDates[bar.startCol]
        grabDayOffsetRef.current =
          differenceInCalendarDays(segDate, startOfDay(bar.schedule.startAt)) + offset
        setActiveWidth(width)
      }}
    />
  </div>
))}
```

#### 인라인 유지 (변경 없음)

- `SmallDayList` (504-552) — dot style → `getItemDotStyle(s)` 적용

### 3-3. `ui/DayView.tsx` (수정: 355→~180줄)

#### 제거 항목

| 제거 대상 | 줄 | 대체 |
|-----------|-----|------|
| DnD 상태 4개 | 38-41 | `useDayDnd` 훅 |
| Resize 상태 2개 | 42-46 | `useScheduleResize` 훅 |
| `handleDragStart` | 94-105 | `useDayDnd` 훅 |
| `handleDragMove` | 107-110 | `useDayDnd` 훅 |
| `handleDragEnd` | 112-150 | `useDayDnd` 훅 |
| `handleResizeStart` | 152-210 | `useScheduleResize` 훅 |
| `const hourHeight = 60` | 212 | `HOUR_HEIGHT` import |
| `const hourHeight = 60` (local) | 118 | 제거 (중복 선언 정리) |

#### 추가 import

```typescript
import { HOUR_HEIGHT, DND_ACTIVATION_CONSTRAINT } from '../model/calendar-constants'
import { useDayDnd } from '../model/use-day-dnd'
import { useScheduleResize } from '../model/use-schedule-resize'
import { getItemStyle } from '../model/schedule-style'
```

#### 리팩토링 후 DayView 구조

```typescript
export function DayView({ schedules, currentDate, workspaceId }: Props): React.JSX.Element {
  const moveSchedule = useMoveSchedule()
  const updateTodo = useUpdateTodo()

  // === useMemo: allDay, timed, clampMap, layoutInput, layouted (기존과 동일) ===
  const { allDay, timed } = useMemo(() => { /* 기존 lines 48-60 */ }, [schedules, currentDate])
  const clampMap = useMemo(() => { /* 기존 lines 63-77 */ }, [timed, currentDate])
  const layoutInput = useMemo(() => { /* 기존 lines 80-86 */ }, [timed, clampMap])
  const layouted = useMemo(() => layoutOverlappingSchedules(layoutInput), [layoutInput])

  // === 훅 적용 ===
  const mutationCallbacks = {
    onMoveSchedule: (p) => moveSchedule.mutate(p),
    onMoveTodo: (p) => updateTodo.mutate(p)
  }

  const dnd = useDayDnd({
    workspaceId,
    hourHeight: HOUR_HEIGHT,
    clampMap,
    ...mutationCallbacks
  })

  const resize = useScheduleResize({
    workspaceId,
    hourHeight: HOUR_HEIGHT,
    clampMap,
    ...mutationCallbacks
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: DND_ACTIVATION_CONSTRAINT })
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={dnd.handleDragStart}
      onDragMove={dnd.handleDragMove}
      onDragEnd={dnd.handleDragEnd}
    >
      {/* allDay 섹션 — getItemStyle 적용 */}
      {/* TimeGrid + ScheduleBlock — hourHeight → HOUR_HEIGHT */}
      {/* DnD preview — dnd.activeSchedule, dnd.previewDelta */}
      {/* Resize preview — resize.resizing, resize.resizeDelta */}
      {/* ScheduleDragOverlay — dnd.activeSchedule, dnd.activeType, dnd.activeSize */}
    </DndContext>
  )
}
```

---

## 4. Phase 4: barrel export

### 4-1. `index.ts` (수정)

기존 36개 export 전부 유지. import 소스만 변경 (calendar-utils barrel을 통해 동일 경로 유지).

```typescript
// model — use-calendar (2)
export { useCalendar, type CalendarViewType } from './model/use-calendar'

// model — calendar-utils barrel (15: 11 functions + 4 types)
export {
  getMonthGrid,
  getWeekDates,
  getTimeSlots,
  timeToPosition,
  scheduleHeight,
  isScheduleOnDate,
  splitBarByWeeks,
  layoutOverlappingSchedules,
  moveScheduleByDays,
  moveScheduleByMinutes,
  isTodoItem,
  type MonthGridDay,
  type TimeSlot,
  type LayoutedSchedule,
  type WeekBarSegment
} from './model/calendar-utils'

// model — schedule-color (3)
export {
  SCHEDULE_COLOR_PRESETS,
  PRIORITY_COLORS,
  getScheduleColor
} from './model/schedule-color'

// ui (16)
export { CalendarNavigation } from './ui/CalendarNavigation'
export { ScheduleFormDialog } from './ui/ScheduleFormDialog'
export { DeleteScheduleDialog } from './ui/DeleteScheduleDialog'
export { ScheduleDetailPopover } from './ui/ScheduleDetailPopover'
export { ColorPicker } from './ui/ColorPicker'
export { CurrentTimeIndicator } from './ui/CurrentTimeIndicator'
export { TimeGrid } from './ui/TimeGrid'
export { ScheduleBlock } from './ui/ScheduleBlock'
export { ScheduleBar } from './ui/ScheduleBar'
export { ScheduleDot } from './ui/ScheduleDot'
export { MonthDayCell } from './ui/MonthDayCell'
export { MonthView } from './ui/MonthView'
export { WeekView } from './ui/WeekView'
export { DayView } from './ui/DayView'
export { LinkedTodoList } from './ui/LinkedTodoList'
export { TodoLinkPopover } from './ui/TodoLinkPopover'
```

> **변경 없음**: calendar-utils barrel re-export로 동일 경로 유지. 신규 모듈(calendar-move, use-day-dnd, schedule-style 등)은 feature 내부 사용이므로 barrel export 불필요.

---

## 5. 파일 변경 총정리

### 신규 파일 (11개)

| # | 파일 | 역할 | 줄 수 |
|---|------|------|-------|
| 1 | `model/calendar-constants.ts` | 공통 상수 | ~12 |
| 2 | `model/calendar-predicates.ts` | 판별 함수 | ~15 |
| 3 | `model/calendar-grid.ts` | 그리드/날짜 생성 | ~40 |
| 4 | `model/calendar-layout.ts` | lane/겹침 레이아웃 | ~160 |
| 5 | `model/calendar-time.ts` | 시간 계산 | ~25 |
| 6 | `model/calendar-move.ts` | DnD mutation 유틸 | ~50 |
| 7 | `model/schedule-style.ts` | Todo/Schedule 스타일 | ~25 |
| 8 | `model/use-day-dnd.ts` | DayView DnD 훅 | ~80 |
| 9 | `model/use-schedule-resize.ts` | DayView Resize 훅 | ~70 |
| 10 | `ui/ScheduleBarItem.tsx` | 통합 기간 바 | ~65 |
| 11 | `ui/WeekDayCell.tsx` | WeekView droppable 셀 | ~85 |

### 수정 파일 (4개)

| # | 파일 | 변경 | before → after |
|---|------|------|----------------|
| 1 | `model/calendar-utils.ts` | barrel re-export 전환 | 252 → ~10 |
| 2 | `ui/MonthView.tsx` | BarItem→ScheduleBarItem, assignLanes 제거, applyDaysDelta | 524 → ~430 |
| 3 | `ui/WeekView.tsx` | BarItem→ScheduleBarItem, WeekDayCell 추출, applyDaysDelta | 553 → ~358 |
| 4 | `ui/DayView.tsx` | useDayDnd + useScheduleResize 훅 적용 | 355 → ~180 |

### 변경 없는 파일

- `model/use-calendar.ts` — 변경 없음
- `model/schedule-color.ts` — 변경 없음
- `ui/ScheduleBlock.tsx` — 변경 없음 (리팩토링 범위 외)
- `ui/MonthDayCell.tsx` — 변경 없음
- `index.ts` — import 소스 변경 없음 (barrel 경로 호환)

---

## 6. 검증 체크리스트

Phase별 완료 후 `npm run typecheck && npm run lint` 실행.

최종 검증 (Plan 문서 체크리스트 16항목):

| # | 항목 | 확인 방법 |
|---|------|----------|
| 1 | MonthView 기간 바 DnD | 드래그 후 startAt/endAt 날짜 변경 |
| 2 | MonthView 단일 일정 DnD | 드래그 후 날짜 변경 |
| 3 | MonthView Todo DnD | 드래그 후 startDate/dueDate 변경 |
| 4 | MonthView 소형 빈 상태 | 일정 없는 날 → 하단 목록 사라짐 |
| 5 | WeekView 기간 바 DnD | 드래그 후 날짜 변경 + overlay width |
| 6 | WeekView 단일 일정 DnD | 드래그 후 날짜 변경 |
| 7 | WeekView Todo DnD | 드래그 후 startDate/dueDate 변경 |
| 8 | WeekView 소형 빈 상태 | "일정 없음" 표시 |
| 9 | DayView 블록 DnD (schedule) | 시간 변경 (15분 스냅) |
| 10 | DayView 블록 DnD (todo) | **시간만 변경, 날짜 보존** |
| 11 | DayView Resize top | 시작 시간만 변경 |
| 12 | DayView Resize bottom | 종료 시간만 변경 |
| 13 | DayView Todo Resize | 시간만 변경, 날짜 보존 |
| 14 | 기간 바 프리뷰 (Month) | splitBarByWeeks 기반 위치 정상 |
| 15 | 기간 바 프리뷰 (Week) | clamping 기반 위치 정상 |
| 16 | barrel export 호환 | CalendarPage, CalendarViewToolbar import 정상 |
