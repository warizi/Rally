# Calendar 리팩토링 Plan

## Overview

캘린더 기능의 3개 뷰(MonthView 524줄, WeekView 553줄, DayView 355줄)가 단일 파일에 모든 로직과 서브 컴포넌트를 포함하고 있어 유지보수가 어렵다. 코드 중복이 심하고, 공통 로직이 분산되어 있으며, `calendar-utils.ts`(252줄)에 서로 관련 없는 유틸리티가 혼재되어 있다.

이 리팩토링은 **기능 변경 없이** 구조 개선에 집중한다.

---

## 문제 분석

### 1. 코드 중복

| 중복 항목                                      | 위치                                    | 설명                                                         |
| ---------------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `handleDragEnd` mutation 로직                  | MonthView:158-174, WeekView:171-187     | isTodoItem 분기 + daysDelta 기반 mutation 호출 **동일 패턴** |
| `MonthBarItem` / `WeekBarItem`                 | MonthView:322-388, WeekView:354-415     | 기간 바 렌더링 (95% 동일, 차이는 prop으로 제어 가능)         |
| `assignLanes` / `computeWeekBars` 내 lane 할당 | MonthView:48-76, WeekView:69-93         | 동일한 greedy lane 할당 알고리즘                             |
| Todo 스타일 로직                               | MonthView, WeekView, DayView 전체       | `isTodoItem ? 'transparent' : ${color}20` 패턴 10회+ 반복    |
| `WEEKDAY_LABELS`                               | MonthView:39, WeekView:32               | `['일','월','화','수','목','금','토']` 2회 선언              |
| DnD 센서 설정                                  | MonthView:123, WeekView:131, DayView:90 | `PointerSensor { delay: 200, tolerance: 5 }` 3회 동일        |

### 2. 거대 컴포넌트 (단일 파일에 모든 것 포함)

| 파일          | 줄 수 | 인라인 서브 컴포넌트 수                                                             |
| ------------- | ----- | ----------------------------------------------------------------------------------- |
| MonthView.tsx | 524   | 5개 (MonthBarItem, DraggableScheduleItem, CellContent, SelectedDateList, MonthView) |
| WeekView.tsx  | 553   | 5개 (WeekBarItem, WeekDayCell, DraggableScheduleItem, SmallDayList, WeekView)       |
| DayView.tsx   | 355   | 1개 (DayView — 단일이지만 DnD+Resize 로직 173줄, lines 38-210)                      |

### 3. 유틸리티 혼재 (`calendar-utils.ts`)

현재 하나의 파일에 관심사가 다른 함수들이 혼재:

| 함수                                          | 카테고리      | 사용 뷰                   |
| --------------------------------------------- | ------------- | ------------------------- |
| `getMonthGrid`                                | 그리드 생성   | MonthView only            |
| `splitBarByWeeks`                             | 바 분할       | MonthView only            |
| `getWeekDates`                                | 날짜 생성     | WeekView only             |
| `getTimeSlots`                                | 시간 슬롯     | DayView only              |
| `timeToPosition`, `scheduleHeight`            | 렌더링 수학   | DayView only              |
| `layoutOverlappingSchedules`                  | 겹침 레이아웃 | DayView (+ WeekView 가능) |
| `moveScheduleByDays`, `moveScheduleByMinutes` | DnD           | 뷰별 사용                 |
| `isTodoItem`, `isScheduleOnDate`              | 판별          | 전체 공용                 |

### 4. 상수 불일치

| 상수             | MonthView | WeekView  | DayView     |
| ---------------- | --------- | --------- | ----------- |
| `BAR_HEIGHT`     | 18        | 20        | -           |
| `BAR_GAP`        | 2         | 2         | -           |
| `hourHeight`     | -         | -         | 60 (inline) |
| `WEEKDAY_LABELS` | 선언      | 중복 선언 | -           |

---

## DnD 패러다임 차이 분석

3개 뷰의 DnD는 **근본적으로 다른 패러다임**이므로 단일 추상화 불가.

### MonthView / WeekView (날짜 기반)

| 항목       | 값                                                     |
| ---------- | ------------------------------------------------------ |
| 이벤트     | `onDragOver` (`DragOverEvent`) — 이산적 hover          |
| Delta 단위 | 일(days) 정수                                          |
| 타겟 판별  | droppable의 date 데이터                                |
| mutation   | `startDate/dueDate`에 `daysDelta * 86400000` 직접 합산 |

### DayView (시간 기반)

| 항목          | 값                                                                                  |
| ------------- | ----------------------------------------------------------------------------------- |
| 이벤트        | `onDragMove` (`DragMoveEvent`) — 연속적 pixel delta                                 |
| Delta 단위    | 분(minutes) 15분 스냅                                                               |
| 타겟 판별     | `event.delta.y` (droppable 불필요)                                                  |
| Todo mutation | **clampMap에서 표시 시간 추출 → setHours/setMinutes로 시간만 변경, 원래 날짜 보존** |
| 추가 기능     | Resize (top/bottom edge)                                                            |

### 통합 판정

- MonthView / WeekView의 `handleDragEnd` 내 **mutation 호출 패턴은 동일** → 순수 유틸 함수로 추출 가능
- DayView는 clampMap + 시간 보존 로직이 고유 → **별도 훅 필요**
- 상태 관리(`activeSchedule`, `grabOffset` 등)는 뷰마다 다르므로 각 뷰에 유지

---

## 컴포넌트 통합/분리 판정

### ScheduleBarItem (MonthBarItem / WeekBarItem) → **통합**

95% 동일한 코드(62~66줄씩). 차이점은 prop으로 제어 가능:

| 차이점    | MonthBarItem                | WeekBarItem                       | prop                                       |
| --------- | --------------------------- | --------------------------------- | ------------------------------------------ |
| ID        | `bar-${id}-w${weekIdx}`     | `week-bar-${id}`                  | `draggableId: string`                      |
| data      | `{ schedule, type: 'bar' }` | `{ schedule, type: 'bar', span }` | `draggableData?: Record<string, unknown>`  |
| onGrab    | `(offset) => void`          | `(offset, width) => void`         | `(offset: number, width?: number) => void` |
| 래퍼      | `pointer-events-auto` div   | 없음                              | `wrapperClassName?: string`                |
| barHeight | 18                          | 20                                | `barHeight: number`                        |

**판정**: 128줄 → ~60줄로 절반 감소. prop이 직관적이고 의미가 명확함.

### SmallScheduleList (SelectedDateList / SmallDayList) → **분리 유지**

| 차이점   | SelectedDateList                        | SmallDayList         |
| -------- | --------------------------------------- | -------------------- |
| 빈 상태  | `return null` (DOM 제거)                | `"일정 없음"` 렌더링 |
| 스크롤   | 없음 (`max-h-32`)                       | `ScrollArea` 사용    |
| 헤더     | `"M월 d일 일정"`                        | 없음                 |
| 컨테이너 | `@[400px]:hidden border-t p-2 max-h-32` | `flex-1 min-h-0`     |

**판정**: 동작이 **반대** (hide vs show)이고 레이아웃 아키텍처가 다름. `emptyBehavior`, `scrollable`, `showHeader` 3개 prop을 조합해야 하면 가독성이 오히려 나빠짐. 42~48줄의 소형 컴포넌트를 prop explosion으로 복잡하게 만들 이유 없음. **각 뷰에 인라인 유지.**

### DraggableScheduleItem → **사용처 기준 co-locate**

|        | MonthView                      | WeekView                     |
| ------ | ------------------------------ | ---------------------------- |
| 코드량 | 20줄                           | 18줄                         |
| ID     | `month-single-${id}-${dayKey}` | `week-single-${id}`          |
| 사용처 | CellContent (MonthView 인라인) | WeekDayCell (별도 파일 추출) |
| 나머지 | 완전 동일                      | 완전 동일                    |

**판정**: 18~20줄짜리 컴포넌트를 독립 파일로 추출하면 과도. **사용하는 컴포넌트와 같은 스코프에 유지**:

- MonthView의 DraggableScheduleItem → CellContent가 사용 → MonthView.tsx에 인라인 유지
- WeekView의 DraggableScheduleItem → WeekDayCell이 사용 → WeekDayCell.tsx에 co-locate

### use-calendar-dnd → **순수 유틸 함수 (Hook X)**

기존 Plan의 `useCalendarDndMutation` 훅은 내부에 `useMoveSchedule()`, `useUpdateTodo()`를 호출하지만, 실제 로직은 **상태 없는 순수 분기**임. mutation 인스턴스는 각 뷰에서 이미 생성하므로, 콜백 주입 방식의 유틸 함수가 더 적합:

```ts
// 상태 없음 → Hook이 아닌 순수 함수
export function applyDaysDelta(
  schedule: ScheduleItem,
  daysDelta: number,
  callbacks: {
    onMoveSchedule: (id: string, startAt: Date, endAt: Date) => void
    onMoveTodo: (todoId: string, startDate: Date, dueDate: Date) => void
  }
): void
```

**이점**:

- 테스트 가능 (React 의존 없음)
- mutation 인스턴스의 소유권이 뷰 컴포넌트에 남아 명확
- 각 뷰의 `handleDragEnd`에서 `applyDaysDelta(schedule, delta, { onMoveSchedule: ..., onMoveTodo: ... })` 호출

---

## 리팩토링 목표

1. **중복 제거**: 실질적으로 동일한 코드만 통합 (BarItem, lane 알고리즘, mutation 패턴, 스타일 헬퍼)
2. **컴포넌트 분리**: 거대 뷰 파일에서 의미 있는 크기의 서브 컴포넌트만 추출
3. **유틸리티 모듈화**: 뷰별 관심사 + 공용 판별/스타일로 분리
4. **상수 통합**: 분산된 상수를 중앙 관리
5. **과도한 추상화 금지**: 18줄 컴포넌트 추출, 42줄 컴포넌트 통합 등 가독성을 해치는 추상화 지양

---

## 구현 범위

### Phase 1: 상수 & 유틸리티 정리

#### Task 1-1: 상수 파일 생성

**신규 파일**: `model/calendar-constants.ts`

```ts
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const
export const MONTH_BAR_HEIGHT = 18
export const WEEK_BAR_HEIGHT = 20
export const BAR_GAP = 2
export const HOUR_HEIGHT = 60
export const START_HOUR = 6
export const DND_SENSOR_CONFIG = { delay: 200, tolerance: 5 } as const
```

#### Task 1-2: `calendar-utils.ts` 관심사별 분리

현재 252줄을 **사용 뷰 기준 + 공용 판별** 4개 파일로 분리:

| 신규 파일                | 포함 함수                                                             | 사용 뷰        |
| ------------------------ | --------------------------------------------------------------------- | -------------- |
| `calendar-predicates.ts` | `isTodoItem`, `isScheduleOnDate`                                      | 전체 공용      |
| `calendar-layout.ts`     | `layoutOverlappingSchedules`, `splitBarByWeeks`, `assignLanes`        | Month/Week/Day |
| `calendar-time.ts`       | `getTimeSlots`, `timeToPosition`, `scheduleHeight` + 타입(`TimeSlot`) | Day (+ Week)   |
| `calendar-grid.ts`       | `getMonthGrid`, `getWeekDates` + 타입(`MonthGridDay`)                 | Month/Week     |

DnD 유틸(`moveScheduleByDays`, `moveScheduleByMinutes`)은 `calendar-move.ts`로 분리:

| 신규 파일          | 포함 함수                                                              | 설명                   |
| ------------------ | ---------------------------------------------------------------------- | ---------------------- |
| `calendar-move.ts` | `moveScheduleByDays`, `moveScheduleByMinutes`, `applyDaysDelta` (신규) | DnD mutation 패턴 포함 |

기존 `calendar-utils.ts`는 re-export barrel로 전환:

```ts
export * from './calendar-predicates'
export * from './calendar-layout'
export * from './calendar-time'
export * from './calendar-grid'
export * from './calendar-move'
```

타입(`LayoutedSchedule`, `WeekBarSegment`)은 해당 함수와 함께 이동.

#### Task 1-3: `assignLanes` 추출 + `computeWeekBars` 리팩토링

MonthView의 `assignLanes`(48-76줄)를 `calendar-layout.ts`로 추출.
WeekView의 `computeWeekBars`(45-94줄)도 `calendar-layout.ts`로 이동하되, 내부 lane 할당 부분을 `assignLanes` 호출로 교체.

```ts
// calendar-layout.ts
export function assignLanes<T extends { startCol: number; span: number }>(
  items: T[]
): (T & { lane: number })[] {
  // greedy lane 할당 — 제네릭으로 Month/Week 모두 사용 가능
}

export function computeWeekBars(multiDay: ScheduleItem[], weekDates: Date[]): WeekBar[] {
  // bar 생성 + 경계 클램핑 후 assignLanes() 호출
}
```

### Phase 2: 공통 로직 추출

#### Task 2-1: `calendar-move.ts` — mutation 패턴 유틸 함수

**신규 파일**: `model/calendar-move.ts`

MonthView/WeekView에서 공통인 mutation 분기를 **순수 함수**로 추출 (Hook 아님):

```ts
import { isTodoItem } from './calendar-predicates'

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

**사용 예시** (MonthView `handleDragEnd` 내부):

```ts
applyDaysDelta(schedule, daysDelta, {
  onMoveSchedule: (id, start, end) =>
    moveSchedule.mutate({ scheduleId: id, startAt: start, endAt: end, workspaceId }),
  onMoveTodo: (id, start, end) =>
    updateTodo.mutate({ workspaceId, todoId: id, data: { startDate: start, dueDate: end } })
})
```

#### Task 2-2: `use-day-dnd.ts` — DayView 전용 DnD 훅

**신규 파일**: `model/use-day-dnd.ts`

DayView의 DnD 상태 + 핸들러(38~150줄)를 훅으로 추출. DayView 고유 로직이 많아 Hook이 적합:

- `activeSchedule`, `activeType`, `previewDelta`, `activeSize` 상태 관리
- `DragMoveEvent` 기반 연속 pixel delta
- `clampMap` 기반 시간 보존 mutation

```ts
export function useDayDnd(options: {
  workspaceId: string
  hourHeight: number
  clampMap: Map<string, { start: Date; end: Date }>
  moveSchedule: (params: {
    scheduleId: string
    startAt: Date
    endAt: Date
    workspaceId: string
  }) => void
  updateTodo: (params: {
    workspaceId: string
    todoId: string
    data: { startDate: Date; dueDate: Date }
  }) => void
}) {
  // 상태 4개 + 핸들러 3개 캡슐화
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

> **hourHeight 중복 선언 주의**: 현재 DayView에서 `handleDragMove`(line 108)는 컴포넌트 스코프의 `hourHeight`(line 212)를 참조하고, `handleDragEnd`(line 118)는 `const hourHeight = 60`으로 로컬 재선언. 런타임에는 양쪽 모두 60이므로 동작 버그는 아니나, 훅 추출 시 `options.hourHeight`를 일관되게 사용하여 중복 제거 필요.

````

#### Task 2-3: `use-schedule-resize.ts` — DayView 전용 Resize 훅

**신규 파일**: `model/use-schedule-resize.ts`

DayView의 resize 핸들러(152~210줄) 추출. pointer event 기반 `document.addEventListener` 패턴.

#### Task 2-4: `ScheduleBarItem` 통합

**신규 파일**: `ui/ScheduleBarItem.tsx`

`MonthBarItem`(66줄)과 `WeekBarItem`(62줄)을 통합 → ~60줄:

```ts
interface Props {
  schedule: ScheduleItem
  workspaceId: string
  startCol: number
  span: number
  lane: number
  isStart: boolean
  isEnd: boolean
  barHeight: number                      // MONTH_BAR_HEIGHT(18) | WEEK_BAR_HEIGHT(20)
  draggableId: string                    // 각 뷰에서 기존 형식 그대로 전달
  draggableData?: Record<string, unknown> // WeekView: { span } 추가
  onGrab: (offset: number, width?: number) => void
  wrapperClassName?: string              // MonthView: 'pointer-events-auto'
}
````

#### Task 2-5: `schedule-style.ts` — Todo/Schedule 스타일 헬퍼

**신규 파일**: `model/schedule-style.ts`

10회 이상 반복되는 스타일 분기를 유틸 함수로 추출:

```ts
/** 일정 아이템 배경 스타일 (블록/바 공용) */
export function getItemStyle(schedule: ScheduleItem): {
  backgroundColor: string
  border: string | undefined
  color: string
}

/** 일정 도트 스타일 (소형 뷰) */
export function getItemDotStyle(schedule: ScheduleItem): {
  backgroundColor: string
  border: string | undefined
}
```

### Phase 3: 뷰 컴포넌트 분리

#### Task 3-1: MonthView 분리

`MonthView.tsx`(524줄)에서 추출:

| 추출 대상               | 줄             | 이동 위치                  | 판정 근거                                     |
| ----------------------- | -------------- | -------------------------- | --------------------------------------------- |
| `MonthBarItem`          | 322-388 (66줄) | `ScheduleBarItem.tsx` 대체 | 95% 동일 → 통합 적합                          |
| `assignLanes`           | 48-76 (29줄)   | `calendar-layout.ts` 이동  | 알고리즘 공유                                 |
| `CellContent`           | 413-478 (66줄) | **인라인 유지**            | 아래 주의사항 참조                            |
| `DraggableScheduleItem` | 390-410 (20줄) | **인라인 유지**            | 18줄에 별도 파일은 과도                       |
| `SelectedDateList`      | 482-523 (42줄) | **인라인 유지**            | SmallDayList와 동작 반대, 통합 시 가독성 저하 |

> **CellContent → MonthDayCell 통합 불가 사유**: CellContent 내부(line 459)에서 MonthView에 인라인 정의된 `DraggableScheduleItem`을 사용. MonthDayCell로 옮기면 (1) MonthDayCell의 `children: ReactNode` prop 인터페이스가 변경되고, (2) DraggableScheduleItem을 별도 파일로 추출하거나 prop으로 주입해야 하는 불필요한 복잡성 발생. CellContent(66줄)는 MonthView 스코프에서 가장 자연스럽게 동작하므로 인라인 유지.

MonthView에서 **제거되는 코드**: ~95줄 (MonthBarItem + assignLanes)
MonthView에서 **유지되는 코드**: DnD 상태관리, 프리뷰, 그리드 렌더링, CellContent, SelectedDateList, DraggableScheduleItem
리팩토링 후 예상: **524 → ~430줄**

#### Task 3-2: WeekView 분리

`WeekView.tsx`(553줄)에서 추출:

| 추출 대상               | 줄             | 이동 위치                     | 판정 근거                                         |
| ----------------------- | -------------- | ----------------------------- | ------------------------------------------------- |
| `WeekBarItem`           | 354-415 (62줄) | `ScheduleBarItem.tsx` 대체    | 95% 동일 → 통합 적합                              |
| `WeekDayCell`           | 418-482 (65줄) | `WeekDayCell.tsx` (신규)      | 독립적 droppable 셀, 분리 적합                    |
| `computeWeekBars`       | 45-94 (50줄)   | `calendar-layout.ts` 이동     | 레이아웃 알고리즘                                 |
| `DraggableScheduleItem` | 484-502 (18줄) | `WeekDayCell.tsx`에 co-locate | 아래 주의사항 참조                                |
| `SmallDayList`          | 504-552 (48줄) | **인라인 유지**               | SelectedDateList와 동작 반대, 통합 시 가독성 저하 |

> **DraggableScheduleItem → WeekDayCell co-locate 사유**: WeekDayCell 내부(line 447)에서 `DraggableScheduleItem`을 렌더링. MonthView의 CellContent→MonthDayCell 통합 불가와 동일한 의존성 패턴. WeekDayCell이 별도 파일로 추출되면 DraggableScheduleItem을 참조할 수 없으므로, 18줄짜리 DraggableScheduleItem을 WeekDayCell.tsx에 같이 배치. 별도 파일이 아닌 **같은 파일 내 인라인**이므로 파일 탐색 오버헤드 없음.

WeekView에서 **제거되는 코드**: ~195줄 (WeekBarItem + WeekDayCell + DraggableScheduleItem + computeWeekBars)
리팩토링 후 예상: **553 → ~358줄**

#### Task 3-3: DayView 훅 적용

`DayView.tsx`(355줄)에서 추출:

| 추출 대상         | 줄             | 이동 위치                |
| ----------------- | -------------- | ------------------------ |
| DnD 상태 + 핸들러 | 38-150 (113줄) | `use-day-dnd.ts`         |
| Resize 핸들러     | 152-210 (59줄) | `use-schedule-resize.ts` |

DayView에서 **제거되는 코드**: ~172줄
DayView에서 **유지되는 코드**: allDay/timed 분류, clampMap 생성, layouted useMemo, JSX
리팩토링 후 예상: **355 → ~180줄**

### Phase 4: barrel export 정리

#### Task 4-1: feature barrel export 업데이트

`manage-schedule/index.ts` 업데이트. **기존 36개 export 전부 유지** (외부 소비자: CalendarPage.tsx, CalendarViewToolbar.tsx).

주요 외부 사용 항목: `CalendarNavigation`, `MonthView`, `WeekView`, `DayView`, `ScheduleFormDialog`, `useCalendar`, `CalendarViewType`

기존 barrel에서 `calendar-utils` re-export로 내보내던 유틸/타입들도 그대로 유지하여 **import 경로 깨짐 없음** 보장.

신규 내부 모듈(`calendar-move`, `use-day-dnd`, `schedule-style` 등)은 feature 내부 사용이므로 barrel export 불필요.

---

## 파일 변경 요약

### 신규 파일 (9개)

| 파일                           | 역할                                                                                              | 줄 수 (예상) |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | ------------ |
| `model/calendar-constants.ts`  | 공통 상수 + DnD 센서 설정                                                                         | ~15          |
| `model/calendar-predicates.ts` | `isTodoItem`, `isScheduleOnDate`                                                                  | ~15          |
| `model/calendar-grid.ts`       | `getMonthGrid`, `getWeekDates` + 타입                                                             | ~45          |
| `model/calendar-layout.ts`     | `assignLanes` (제네릭), `layoutOverlappingSchedules`, `splitBarByWeeks`, `computeWeekBars` + 타입 | ~150         |
| `model/calendar-time.ts`       | `getTimeSlots`, `timeToPosition`, `scheduleHeight`                                                | ~25          |
| `model/calendar-move.ts`       | `moveScheduleByDays`, `moveScheduleByMinutes`, `applyDaysDelta`                                   | ~45          |
| `model/use-day-dnd.ts`         | DayView 전용 DnD 훅 (상태 + 핸들러)                                                               | ~80          |
| `model/use-schedule-resize.ts` | DayView 전용 Resize 훅                                                                            | ~65          |
| `model/schedule-style.ts`      | Todo/Schedule 스타일 헬퍼                                                                         | ~25          |

### 수정 파일 (5개)

| 파일                            | 변경                                                                                                         | 줄 수 (before → after) |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `model/calendar-utils.ts`       | barrel re-export로 전환                                                                                      | 252 → ~10              |
| `ui/MonthView.tsx`              | BarItem→ScheduleBarItem, assignLanes 제거, `applyDaysDelta` 사용 (CellContent 인라인 유지)                   | 524 → ~430             |
| `ui/WeekView.tsx`               | BarItem→ScheduleBarItem, WeekDayCell+DraggableScheduleItem 추출, computeWeekBars 제거, `applyDaysDelta` 사용 | 553 → ~358             |
| `ui/DayView.tsx`                | `useDayDnd` + `useScheduleResize` 훅 적용 (hourHeight 중복 선언 정리 포함)                                   | 355 → ~180             |
| `ui/ScheduleBarItem.tsx` (신규) | MonthBarItem + WeekBarItem 통합                                                                              | ~60                    |

### 신규 UI 파일 (2개)

| 파일                     | 역할                                                               | 줄 수 (예상) |
| ------------------------ | ------------------------------------------------------------------ | ------------ |
| `ui/ScheduleBarItem.tsx` | 공통 기간 바 아이템                                                | ~60          |
| `ui/WeekDayCell.tsx`     | WeekView에서 추출한 droppable 셀 + DraggableScheduleItem co-locate | ~85          |

### 삭제 파일: 없음

---

## 구현 순서

```
Phase 1 (기반 정리)
  1-1. calendar-constants.ts 생성
  1-2. calendar-utils.ts → predicates + grid + layout + time + move 5개 분리
       calendar-utils.ts는 re-export barrel로 전환
  1-3. assignLanes 제네릭 추출 + computeWeekBars를 calendar-layout.ts로 이동

Phase 2 (공통 추출)
  2-1. calendar-move.ts에 applyDaysDelta 순수 함수 추가
  2-2. use-day-dnd.ts — DayView 전용 DnD 훅
  2-3. use-schedule-resize.ts — DayView 전용 Resize 훅
  2-4. ScheduleBarItem.tsx — MonthBarItem + WeekBarItem 통합
  2-5. schedule-style.ts — 스타일 헬퍼 추출

Phase 3 (뷰 리팩토링) — Phase 1,2 완료 후 진행
  3-1. MonthView.tsx — BarItem→ScheduleBarItem, assignLanes 제거, applyDaysDelta 적용 (CellContent 인라인 유지)
  3-2. WeekView.tsx — BarItem→ScheduleBarItem, WeekDayCell+DraggableScheduleItem 추출, applyDaysDelta 적용
  3-3. DayView.tsx — useDayDnd + useScheduleResize 적용

Phase 4 (마무리)
  4-1. barrel export 정리 (기존 36개 export 전부 유지 확인 (use-calendar 2, calendar-utils 15, schedule-color 3, UI 16))
  4-2. npm run typecheck + npm run lint 통과 확인
  4-3. 사이드 이펙트 방지 체크리스트 수동 검증
```

---

## 통합하지 않는 항목과 근거

| 항목                                  | 판정                        | 근거                                                                                               |
| ------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| `SelectedDateList` / `SmallDayList`   | **분리 유지**               | 빈 상태 동작 반대(null vs 메시지), 스크롤/헤더 유무. 3개 prop 조합은 42줄 컴포넌트보다 가독성 나쁨 |
| `DraggableScheduleItem` (MonthView)   | **인라인 유지**             | 20줄. CellContent가 사용하므로 MonthView 스코프 유지                                               |
| `DraggableScheduleItem` (WeekView)    | **WeekDayCell에 co-locate** | 18줄. WeekDayCell이 사용하므로 같은 파일로 이동                                                    |
| MonthView/WeekView 드래그 프리뷰      | **각 뷰에 유지**            | Month는 `splitBarByWeeks` 기반, Week는 직접 clamping. 알고리즘이 다름                              |
| DayView handleDragEnd mutation → Hook | **순수 함수**               | 상태 없는 분기 로직에 Hook은 과잉. 콜백 주입 패턴이 테스트 가능하고 명확                           |
| `handleDragStart` / `handleDragOver`  | **각 뷰에 유지**            | 상태 변수 방식(useState vs useRef), 이벤트 타입이 뷰마다 다름                                      |

---

## 확장성 고려

### 새 뷰 추가 시 (Year, 3-day 등)

리팩토링 후 새 뷰 추가에 필요한 작업:

1. `CalendarViewType`에 타입 추가
2. `useCalendar`에 dateRange 계산 케이스 추가
3. 새 뷰 컴포넌트 생성 — 공용 유틸(`calendar-layout.ts`, `calendar-move.ts`, `schedule-style.ts`) 재사용 가능
4. `CalendarPage.tsx`에 조건부 렌더링 추가
5. DnD가 날짜 기반이면 `applyDaysDelta` 재사용, 시간 기반이면 `use-day-dnd.ts` 참고

### 새 속성 추가 시 (recurrence, reminders 등)

- `ScheduleItem` 타입 확장
- `schedule-style.ts`에 새 속성 반영 (예: 반복 아이콘 표시)
- `ScheduleBarItem.tsx`의 prop은 `ScheduleItem`을 받으므로 자동 전파
- `applyDaysDelta`는 `ScheduleItem` 기반이므로 새 필드에 영향 없음

---

## 사이드 이펙트 방지 체크리스트

| 항목                              | 확인 방법                                     |
| --------------------------------- | --------------------------------------------- |
| MonthView 기간 바 DnD (날짜 이동) | 드래그 후 startAt/endAt 날짜 변경 확인        |
| MonthView 단일 일정 DnD           | 드래그 후 날짜 변경 확인                      |
| MonthView Todo DnD                | 드래그 후 startDate/dueDate 날짜 변경 확인    |
| MonthView 소형 뷰 빈 상태         | 일정 없는 날짜 선택 시 하단 목록 사라짐 확인  |
| WeekView 기간 바 DnD              | 드래그 후 날짜 변경 + overlay width 정상 확인 |
| WeekView 단일 일정 DnD            | 드래그 후 날짜 변경 확인                      |
| WeekView Todo DnD                 | 드래그 후 startDate/dueDate 변경 확인         |
| WeekView 소형 뷰 빈 상태          | 일정 없는 날짜 선택 시 "일정 없음" 표시 확인  |
| DayView 블록 DnD (schedule)       | 드래그 후 시간 변경 (15분 스냅) 확인          |
| DayView 블록 DnD (todo)           | 드래그 후 **시간만 변경, 날짜 보존** 확인     |
| DayView Resize top edge           | 시작 시간만 변경 확인                         |
| DayView Resize bottom edge        | 종료 시간만 변경 확인                         |
| DayView Todo Resize               | 시간만 변경, 날짜 보존 확인                   |
| 기간 바 드래그 프리뷰 (Month)     | splitBarByWeeks 기반 프리뷰 위치 정상         |
| 기간 바 드래그 프리뷰 (Week)      | clamping 기반 프리뷰 위치 정상                |
| barrel export 호환                | CalendarPage, CalendarViewToolbar import 정상 |

---

## 제약사항 / 주의점

- **기능 변경 없음** — 순수 구조 리팩토링, UI/동작 변경 없음
- **DB 스키마 변경 없음** — migration 불필요
- **외부 인터페이스 유지** — barrel export 기존 39개 전부 호환 유지
- `calendar-utils.ts` re-export barrel로 기존 import 경로 보존
- **DnD 훅은 DayView만** — Month/Week는 순수 유틸 함수 + 상태 각자 관리
- **과도한 통합 금지** — 가독성 저하가 예상되면 분리 유지 (SmallList, DraggableItem)
- 각 Phase 완료 시 `npm run typecheck` + `npm run lint` 검증
- 기존 테스트 없으므로 체크리스트 기반 수동 검증 필수
