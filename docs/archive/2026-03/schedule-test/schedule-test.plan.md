# Plan: Schedule 테스트 코드 작성 (커버율 100%)

## 목표

`features/schedule/manage-schedule/model/` 디렉토리의 모든 순수 함수, 유틸리티, React Hook에 대한 단위 테스트를 작성하여 **100% 커버리지**(line/branch/function)를 달성한다.

## 커버리지 검증 커맨드

```bash
npm run test:web -- --coverage --collectCoverageFrom='src/renderer/src/features/schedule/manage-schedule/model/**/*.ts'
```

## 대상 파일 분석

### 1. 순수 함수 (Pure Functions) — 테스트 우선순위 높음

| 파일                     | 함수                         | 설명                                      |
| ------------------------ | ---------------------------- | ----------------------------------------- |
| `calendar-predicates.ts` | `isTodoItem`                 | schedule.id가 'todo:' 접두사인지 판별     |
|                          | `isScheduleOnDate`           | 특정 날짜에 스케줄이 겹치는지 판별        |
| `calendar-grid.ts`       | `getMonthGrid`               | 월간 달력 그리드 생성 (주 단위 배열)      |
|                          | `getWeekDates`               | 주간 7일 날짜 배열 생성                   |
| `calendar-time.ts`       | `getTimeSlots`               | 시간 슬롯 배열 생성 (START_HOUR ~ 23)     |
|                          | `timeToPosition`             | Date → 픽셀 위치 변환                     |
|                          | `scheduleHeight`             | 시작/종료 시간 → 높이(px) 계산            |
| `calendar-move.ts`       | `moveScheduleByDays`         | 일 단위 이동                              |
|                          | `moveScheduleByMinutes`      | 분 단위 이동 (15분 스냅)                  |
|                          | `applyDaysDelta`             | 일 이동 + 콜백 호출 (todo/schedule 분기)  |
| `calendar-layout.ts`     | `assignLanes`                | 제네릭 레인 할당 알고리즘                 |
|                          | `splitBarByWeeks`            | 여러 날 스케줄을 주 단위로 분할           |
|                          | `computeWeekBars`            | 주간 바 계산 + 레인 할당                  |
|                          | `layoutOverlappingSchedules` | 겹침 레이아웃 (열/클러스터/span)          |
| `schedule-color.ts`      | `getScheduleColor`           | 스케줄 색상 결정 (color ?? priority 색상) |
| `schedule-style.ts`      | `getItemStyle`               | 스케줄 아이템 CSS 스타일 생성             |
|                          | `getItemDotStyle`            | 스케줄 도트 CSS 스타일 생성               |

### 2. React Hooks — 테스트 우선순위 중간

| 파일                     | Hook                | 설명                                          |
| ------------------------ | ------------------- | --------------------------------------------- |
| `use-calendar.ts`        | `useCalendar`       | 달력 뷰 상태 관리 (월/주/일, 이전/다음, 오늘) |
| `use-day-dnd.ts`         | `useDayDnd`         | 일간 드래그앤드롭 상태 관리                   |
| `use-schedule-resize.ts` | `useScheduleResize` | 스케줄 리사이즈 상태 관리                     |

### 3. 테스트 제외

| 파일                    | 사유                           |
| ----------------------- | ------------------------------ |
| `calendar-constants.ts` | 상수 값만 export — 로직 없음   |
| `calendar-utils.ts`     | barrel re-export만 — 로직 없음 |

## 테스트 파일 구조

```
model/__tests__/
├── helpers.ts                         — makeScheduleItem, makeMonthGrid 등 공용 헬퍼
├── calendar-predicates.test.ts        — isTodoItem, isScheduleOnDate
├── calendar-grid.test.ts             — getMonthGrid, getWeekDates           [vi.useFakeTimers 필수]
├── calendar-time.test.ts             — getTimeSlots, timeToPosition, scheduleHeight
├── calendar-move.test.ts             — moveScheduleByDays, moveScheduleByMinutes, applyDaysDelta
├── calendar-layout.test.ts           — assignLanes, splitBarByWeeks, computeWeekBars, layoutOverlappingSchedules
├── schedule-color.test.ts            — getScheduleColor
├── schedule-style.test.ts            — getItemStyle, getItemDotStyle
├── use-calendar.test.ts              — useCalendar hook                     [vi.useFakeTimers 필수]
├── use-day-dnd.test.ts               — useDayDnd hook
└── use-schedule-resize.test.ts       — useScheduleResize hook               [document.dispatchEvent]
```

## 공용 테스트 헬퍼 (`helpers.ts`)

```typescript
// model/__tests__/helpers.ts
import type { ScheduleItem } from '@entities/schedule'
import type { MonthGridDay } from '../calendar-grid'

export function makeScheduleItem(overrides?: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: 'sched-1',
    workspaceId: 'ws-1',
    title: 'Test Schedule',
    description: null,
    location: null,
    allDay: false,
    startAt: new Date('2026-03-02T09:00:00'),
    endAt: new Date('2026-03-02T10:00:00'),
    color: null,
    priority: 'medium',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

// splitBarByWeeks 테스트용 수동 monthGrid (getMonthGrid 의존 없이 격리)
export function makeWeek(startDate: Date, month: number): MonthGridDay[] { ... }
export function makeMonthGrid(year: number, month: number): MonthGridDay[][] { ... }
```

**위치**: `model/__tests__/helpers.ts` — 테스트 파일과 동일 디렉토리에 배치하여 import 간결하게 유지.

## 테스트 케이스 상세

---

### calendar-predicates.test.ts

**`isTodoItem`**:

- `id='todo:abc123'` → `true`
- `id='sched-1'` → `false`
- `id='todo:'` (접두사만) → `true`
- `id='TODO:abc'` (대문자) → `false`

**`isScheduleOnDate`**:

- 당일 내 시작/종료 → `true`
- 여러 날 걸쳐 당일 포함 → `true`
- 완전히 이전 날 → `false`
- 완전히 이후 날 → `false`
- **경계값**: `startAt`이 정확히 `dayEnd(23:59:59.999)`와 같을 때 → `true` (`<=`)
- **경계값**: `endAt`이 정확히 `dayStart(00:00:00.000)`와 같을 때 → `true` (`>=`)

---

### calendar-grid.test.ts [vi.useFakeTimers 필수]

**시간 고정 전략**:

```typescript
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-15T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})
```

> **주의 [G-1]**: `getMonthGrid(year, month)`의 month는 **0-indexed** (JS Date 규약).
> 3월 = `month=2`, 11월 = `month=10`, 12월 = `month=11`, 2월 = `month=1`.
> 테스트 코드에서 반드시 0-indexed로 호출할 것.

**`getMonthGrid`**:

- `getMonthGrid(2026, 2)` (3월): 각 주 7일, 총 5주
- `getMonthGrid(2026, 1)` (2월, 1일이 일요일): 첫 주에 패딩 없음
- `getMonthGrid(2025, 10)` (11월, 1일이 토요일): 6주 그리드 생성
- `isCurrentMonth`: 3월 날짜만 `true`, 2월/4월 패딩은 `false`
- `isToday`: 시간 고정된 3월 15일만 `true`, 나머지 전부 `false`
- **[G-2] isToday 패딩 영역**: 시간을 `2026-02-28`로 고정 후 `getMonthGrid(2026, 2)` (3월 뷰) 호출 → 패딩 영역의 2월 28일 셀이 `isToday=true`
- **[G-3] 윤년**: `getMonthGrid(2024, 1)` (2024년 2월, 29일까지) → 주 수 확인
- **[G-3] 12월 경계**: `getMonthGrid(2026, 11)` (12월) → 다음해 1월 패딩의 `isCurrentMonth=false`
- **속성 기반 검증**: 모든 주는 정확히 7일, 모든 날짜는 연속적, 첫 날은 일요일

**`getWeekDates`**:

- 7개 날짜 반환
- 첫 날이 일요일 (`getDay() === 0`)
- 날짜가 연속적 (각 차이 = 1일)
- 수요일 입력 → 해당 주 일요일~토요일

---

### calendar-time.test.ts

**`getTimeSlots`**:

- 길이 = `24 - START_HOUR` = 18
- 첫 슬롯: `{ hour: 6, label: '06:00' }`
- 마지막 슬롯: `{ hour: 23, label: '23:00' }`

**`timeToPosition`**:

- `06:00`, hourHeight=60 → `0` (START_HOUR 기준점)
- `07:00`, hourHeight=60 → `60`
- `06:30`, hourHeight=60 → `30`
- `12:00`, hourHeight=60 → `360`
- **음수 케이스**: `03:00`, hourHeight=60 → `-180` (START_HOUR 이전)
- `00:00`, hourHeight=60 → `-360`
- **[T-3] 최대값**: `23:59`, hourHeight=60 → `(23-6+59/60)*60 ≈ 1079`

**`scheduleHeight`**:

- 1시간 (09:00→10:00), hourHeight=60 → `60`
- 30분 (09:00→09:30), hourHeight=60 → `30`
- 2시간 (09:00→11:00), hourHeight=60 → `120`
- **최소값 경계**: 19분, hourHeight=60 → `Math.max(19, 20) = 20`
- **최소값 정확 경계**: 20분, hourHeight=60 → `Math.max(20, 20) = 20`
- **최소값 초과**: 21분, hourHeight=60 → `21`
- 다른 hourHeight (hourHeight=120): 1시간 → `120`
- **[T-1] 0분 (startAt === endAt)**: `differenceInMinutes=0` → `Math.max(0, 20) = 20`
- **[T-2] 음수 기간 (endAt < startAt)**: `differenceInMinutes` 음수 → `Math.max(음수, 20) = 20`

---

### calendar-move.test.ts

**`moveScheduleByDays`**:

- +1일: startAt/endAt 모두 1일 후
- -1일: 1일 전
- 0일: 변동 없음
- +7일: 1주 후

**`moveScheduleByMinutes`** (15분 스냅):

- 15분 → snapped=15, 15분 이동
- 30분 → snapped=30
- -15분 → snapped=-15
- **스냅 경계 — 반올림**:
  - 7분 → `Math.round(7/15)*15 = 0` (변동 없음)
  - 8분 → `Math.round(8/15)*15 = 15`
  - -7분 → `0`
  - -8분 → `-15`
  - 22분 → `Math.round(22/15)*15 = 15`
  - 23분 → `Math.round(23/15)*15 = 30`
- 0분 → snapped=0 (변동 없음)
- **[M-1] 기간 보존 속성**: 이동 후 `endAt.getTime() - startAt.getTime()`이 이동 전과 동일한지 단언

**`applyDaysDelta`**:

- `daysDelta=0` → 콜백 미호출 (early return)
- 일반 스케줄 + `daysDelta=1` → `onMoveSchedule(schedule.id, ...)` 호출
- todo 아이템 (`id='todo:abc123'`) + `daysDelta=1` → `onMoveTodo('abc123', ...)` 호출
- **ID 슬라이싱 검증**: `'todo:abc123'.slice(5)` → `'abc123'` 정확히 전달되는지
- 콜백에 전달된 startAt/endAt이 moveScheduleByDays 결과와 일치하는지

---

### calendar-layout.test.ts

**`assignLanes`**:

- 빈 배열 → 빈 배열
- 단일 세그먼트 → `lane=0`
- 겹치지 않는 2개 (A: col=0 span=2, B: col=3 span=1) → 같은 `lane=0` 재사용
- 겹치는 2개 (A: col=0 span=3, B: col=1 span=2) → 다른 lane (0, 1)
- **정렬 검증**: 같은 `startCol`일 때 `span` 큰 것이 먼저 → 더 긴 세그먼트가 낮은 lane
- 3개 이상 겹침 → lane 0, 1, 2 순서
- **[L-1] endCol === startCol 경계**: A(col=0, span=2) → endCol=2. B(col=2, span=1) → `lanes[0].endCol(2) <= startCol(2)` → true → 같은 lane 재사용. `<=`가 `<`였다면 다른 결과임을 검증
- **[L-2] 특정 lane 재사용 (lane 0 아닌 lane 1)**: A(col=0, span=5)→lane0, B(col=0, span=2)→lane1 (A와 겹침). C(col=3, span=1) → lane0의 endCol=5 > 3 불가, lane1의 endCol=2 <= 3 → **lane1 재사용**. 알고리즘이 순서대로 lane을 스캔하여 첫 번째 사용 가능한 lane을 찾는 동작 검증

**`splitBarByWeeks`** (monthGrid는 수동 구성 — 모듈 격리):

- 단일 주 내 1일 스케줄 → segments 1개, isStart=true, isEnd=true
- 단일 주 내 3일 스케줄 → span=3
- 2주에 걸친 스케줄 → segments 2개, 첫 번째 isEnd=false, 두 번째 isStart=false
- 3주에 걸친 스케줄 → segments 3개, 중간 isStart=false+isEnd=false
- monthGrid 범위 완전히 밖 → 빈 배열
- 스케줄이 monthGrid 시작 전부터 시작 → 첫 segment startCol=0 (일요일)
- 스케줄이 monthGrid 끝 이후까지 지속 → 마지막 segment span이 토요일까지
- **[L-3] 경계: schedule.startAt === weekEnd(23:59:59.999)**: `startAt > weekEnd` → false → 포함됨
- **[L-4] 경계: schedule.endAt === weekStart(00:00:00.000)**: `endAt < weekStart` → false → 포함됨

**`computeWeekBars`**:

- 빈 배열 → 빈 배열
- 주간 범위 밖 스케줄 → 필터링 (빈 결과)
- 주간 내 2일 스케줄 → span=2, isStart/isEnd 정확
- 주간 시작 전부터 시작하는 스케줄 → isStart=false, startCol=0
- 주간 끝 이후까지 지속 → isEnd=false
- 겹치는 2개 → 다른 lane 할당
- **[L-8] 같은 날 시작/종료 스케줄**: `differenceInCalendarDays=0` → span=1

**`layoutOverlappingSchedules`**:

- 빈 배열 → 빈 배열
- **단일 스케줄** → `{ column: 0, totalColumns: 1, span: 1 }`
- 겹치지 않는 2개 (A: 9-10시, B: 11-12시) → 같은 column 재사용, 각각 독립 클러스터
- **[L-6] 인접(adjacent) 정합성: A.endAt === B.startAt**:
  - Phase 1 (greedy): `B.startAt(10:00) >= columnEnds[0](10:00)` → true → 같은 col0 재사용
  - Phase 2 (Union-Find): `B.startAt(10:00) < A.endAt(10:00)` → false → 겹침 아님 → 독립 클러스터
  - 결과: 둘 다 col0, 각 totalColumns=1, span=1
- 2개 겹침 (A: 9-11시, B: 10-12시) → column 0,1, totalColumns=2
- 3개 체인 겹침 (A-B 겹침, B-C 겹침, A-C 안겹침) → 같은 클러스터, totalColumns 정확
- **[L-7] 동일 startAt 복수 스케줄**: A(9-11), B(9-10) → 같은 startAt, 정렬 후 열 할당 정확성
- **2개 독립 클러스터**: (A-B 겹침) + (C-D 겹침, 시간대 분리) → 각 클러스터 독립 totalColumns
- **[L-5] span=2 구체 케이스**:
  ```
  A(9:00-10:00), B(9:00-10:00), C(9:00-11:00), D(10:30-11:00)
  할당: A→col0(ends=10), B→col1(ends=10), C→col2(ends=11), D: 10:30>=10(col0)→col0(ends=11)
  클러스터: A-B✓, A-C✓, B-C✓, C-D✓. 전부 연결. maxCol=2, totalColumns=3
  D(col0) → col1 검사: B(9-10) overlaps D(10:30-11)? 9<11 && 10:30<10 → false → 미점유 → span++
           → col2 검사: C(9-11) overlaps D(10:30-11)? 9<11 && 10:30<11 → true → 점유 → break
  D.span = 2 ✓
  ```
- span 확장 불가 (오른쪽 열이 점유됨) → span=1 유지

---

### schedule-color.test.ts

- `color='#ff0000'`, priority='medium' → `'#ff0000'` (color 우선)
- `color=null`, priority='high' → `'#ef4444'`
- `color=null`, priority='medium' → `'#3b82f6'`
- `color=null`, priority='low' → `'#6b7280'`

---

### schedule-style.test.ts

**`getItemStyle`**:

- 일반 스케줄 (color='#3b82f6') → `{ backgroundColor: '#3b82f620', border: undefined, color: '#3b82f6' }`
- todo 아이템 (id='todo:xxx') → `{ backgroundColor: 'transparent', border: '1px solid #3b82f650', color: '#3b82f6' }`
- **[S-1] color 속성 항상 반환**: todo/non-todo 모두에서 `result.color`가 존재하고 값이 정확한지 검증
- 커스텀 색상 (`color='#ff0000'`)으로 hex 연결 정확성 검증: `'#ff000020'`, `'#ff000050'`

**`getItemDotStyle`**:

- 일반 스케줄 → `{ backgroundColor: '#3b82f6', border: undefined }`
- todo 아이템 → `{ backgroundColor: 'transparent', border: '1.5px solid #3b82f6' }`

---

### use-calendar.test.ts [vi.useFakeTimers 필수]

**시간 고정**: `vi.setSystemTime(new Date('2026-03-15T12:00:00'))`

**초기 상태**:

- 옵션 없음 → viewType='month', currentDate=고정시간, selectedDate=null
- `initialViewType='week'` → viewType='week'
- `initialDate='2026-06-01T00:00:00'` → currentDate=2026-06-01
- 옵션 없음(initialDate 없음) → currentDate=new Date() (고정시간)

**setViewType**:

- 'week' → viewType 변경, title/dateRange 재계산
- **[UC-2] currentDate 불변**: month→week 전환 후에도 currentDate는 변경되지 않음

**goPrev/goNext**:

- month 뷰: goPrev → 2월, goNext → 4월
- week 뷰: goPrev → 1주 전, goNext → 1주 후
- day 뷰: goPrev → 1일 전, goNext → 1일 후
- **[UC-1] 왕복 검증 (round-trip)**: 각 뷰에서 goPrev → goNext → 원래 날짜로 복귀

**goToday**: 이전/다음으로 이동 후 goToday → currentDate=고정시간 복귀, selectedDate=null

**selectDate**: 특정 날짜 → selectedDate=해당날짜, currentDate=해당날짜 (둘 다 업데이트)

**title 포맷**:

- month: `'2026년 3월'`
- week: `'2026년 3월 15일 ~ 3월 21일'` 형식
- day: `'2026년 3월 15일 (일)'` 형식

**dateRange**:

- month: startOfWeek(startOfMonth) ~ endOfWeek(endOfMonth)
- week: startOfWeek ~ endOfWeek
- day: startOfDay ~ endOfDay

---

### use-day-dnd.test.ts

**DnD 이벤트 모킹 전략**:
@dnd-kit 이벤트를 plain object로 최소한의 shape만 구성하여 모킹:

```typescript
const mockDragStartEvent = {
  active: {
    data: { current: { schedule: mockSchedule, type: 'block' } }
  },
  activatorEvent: { target: null } // DOM 없는 환경 대응
} as unknown as DragStartEvent
```

**초기 상태**: activeSchedule=null, activeType='block', previewDelta=0, activeSize=undefined

**handleDragStart**:

- schedule 있는 이벤트 → activeSchedule 설정
- schedule 없는 이벤트 → activeSchedule=null
- type='bar' → activeType='bar'
- type 없음 → activeType='block' (기본값)
- `activatorEvent.target=null` → activeSize는 undefined 유지 (el이 null)
- **[DD-3] data.current 자체가 undefined**: `active: { data: { current: undefined } }` → schedule=undefined → activeSchedule=null

**handleDragMove**:

- `delta.y=60`, hourHeight=60 → previewDelta=60분
- `delta.y=30`, hourHeight=60 → previewDelta=30분
- `delta.y=0` → previewDelta=0

**handleDragEnd**:

- **[DD-1] 상태 리셋이 early return 전에 실행됨**: schedule 없어도 `activeSchedule=null`, `previewDelta=0`으로 리셋되는지 검증 (line 65-66이 line 67-68보다 먼저)
- schedule 없음 → 콜백 미호출 (early return), 하지만 상태는 리셋됨
- `delta.y=0` → minutesDelta=0 → 콜백 미호출 (early return), 하지만 상태는 리셋됨
- 일반 스케줄 + delta → `onMoveSchedule` 호출, scheduleId/startAt/endAt/workspaceId 검증
- todo 아이템 + delta → `onMoveTodo` 호출, todoId(슬라이싱)/startDate/dueDate 검증
- todo 아이템 + clampMap에 항목 있음 → clamp 기준으로 baseStart/baseEnd 사용
- todo 아이템 + clampMap에 항목 없음 → schedule.startAt/endAt 그대로 사용
- **[DD-2] todo 날짜 보존/시간 변경**: 다일 스케줄(startAt=3/2, endAt=3/5)에서 DnD 시 **날짜는 유지**되고 시간만 변경되는지 검증. `newStart = new Date(schedule.startAt)` → `setHours(movedStart.getHours(), ...)` 패턴
- 호출 후 activeSchedule=null, previewDelta=0으로 리셋

---

### use-schedule-resize.test.ts [document.dispatchEvent 기반]

**PointerEvent 시뮬레이션 전략**:

```typescript
// 1. renderHook으로 hook 초기화
// 2. act(() => handleResizeStart(mockPointerEvent, schedule, 'bottom'))
// 3. act(() => document.dispatchEvent(new PointerEvent('pointermove', { clientY: startY + 60 })))
// 4. act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: startY + 60 })))
```

**초기 상태**: resizing=null, resizeDelta=0

**handleResizeStart**:

- 호출 → resizing 설정 ({ schedule, edge })
- **[SR-2] preventDefault 호출**: mock의 `preventDefault`가 호출되었는지 `expect(mockEvent.preventDefault).toHaveBeenCalled()`

**pointermove 이벤트**:

- `clientY` 변화 → resizeDelta 업데이트 (15분 스냅)
- hourHeight=60에서 60px 이동 → delta=60분
- **[SR-3] 연속 pointermove**: 3회 연속 발생 시 매번 resizeDelta가 업데이트되는지

**pointerup — 일반 스케줄**:

- `edge='bottom'`, delta > 0 → `onMoveSchedule({ endAt: 원래 + offset, startAt: 원래 그대로 })`
- `edge='top'`, delta > 0 → `onMoveSchedule({ startAt: 원래 + offset, endAt: 원래 그대로 })`
- **변경되지 않는 쪽 값 일치 [X-2]**: `edge='bottom'`일 때 startAt이 정확히 `schedule.startAt`과 동일한지 (값 동치)
- **[SR-1] delta=0**: 콜백 미호출이지만 **resizing=null, resizeDelta=0 리셋 + removeEventListener 실행됨**

**pointerup — todo 아이템**:

- `edge='bottom'` → onMoveTodo, dueDate만 변경 (startDate는 clamp 기준)
- `edge='top'` → onMoveTodo, startDate만 변경 (dueDate는 clamp 기준)
- clampMap에 항목 있음 → clamp.start/end 기준
- clampMap에 항목 없음 → schedule.startAt/endAt 기준

**정리 검증**:

- pointerup 후 resizing=null, resizeDelta=0
- `document.removeEventListener` 호출 확인 (메모리 누수 방지)
- **[SR-4] pointerup 후 추가 pointermove 무효**: pointerup 이후 pointermove 이벤트 발생 시 resizeDelta가 변경되지 않는지

---

## 크로스 모듈 정합성 검증 사항

**[X-1] useDayDnd vs useScheduleResize todo 경로 차이**:
두 Hook 모두 `clampMap` + `isTodoItem` 패턴을 공유하지만 적용 방식이 다름:

- `useDayDnd`: start/end **모두** offset 적용 (전체 이동)
- `useScheduleResize`: edge에 따라 **한쪽만** offset 적용 (크기 변경)

테스트에서 이 차이가 명확히 드러나도록:

- 같은 todo 스케줄, 같은 clampMap, 같은 offset으로 두 Hook 각각 실행
- DnD 결과: startDate와 dueDate **모두** 시간 변경
- Resize 결과: edge에 따라 **하나만** 시간 변경, 다른 쪽 불변

---

## 구현 순서

1. `helpers.ts` — 공용 헬퍼 (makeScheduleItem, 수동 monthGrid 생성)
2. `calendar-predicates.test.ts` — 가장 단순한 순수 함수
3. `calendar-grid.test.ts` — date-fns 의존, vi.useFakeTimers 필수, 0-indexed month 주의
4. `calendar-time.test.ts` — 계산 로직, 음수/0분/경계값 포함
5. `calendar-move.test.ts` — 이동 + 스냅 경계값 + 콜백 분기 + 기간 보존
6. `calendar-layout.test.ts` — 가장 복잡한 레이아웃 알고리즘 (4개 함수, span=2 구체 케이스)
7. `schedule-color.test.ts` — 색상 결정
8. `schedule-style.test.ts` — 스타일 생성, color 속성 항상 존재 검증
9. `use-calendar.test.ts` — Hook (renderHook + vi.useFakeTimers + 왕복 검증)
10. `use-day-dnd.test.ts` — DnD Hook (plain object 모킹, early return 전 상태 리셋, todo 날짜 보존)
11. `use-schedule-resize.test.ts` — Resize Hook (document.dispatchEvent, preventDefault, 리스너 정리)

## 기술 스택 및 전략

### 테스트 프레임워크

- Vitest + happy-dom (`vitest.config.web.mts` 기존 설정 사용)
- 실행: `npm run test:web`

### Hook 테스트

- `@testing-library/react`의 `renderHook`, `act`

### 시간 고정 전략 (파일별 명시)

| 파일                  | 필요 여부 | 사유                                           |
| --------------------- | :-------: | ---------------------------------------------- |
| calendar-grid.test.ts | **필수**  | `getMonthGrid`의 `new Date()` → `isToday` 결정 |
| use-calendar.test.ts  | **필수**  | `goToday()`의 `new Date()`, 초기 currentDate   |
| 나머지 8개 파일       |  불필요   | Date를 인자로 받아 사용, 내부 new Date() 없음  |

패턴:

```typescript
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-15T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})
```

### 픽스처 전략 (모듈 격리)

| 대상                                     | 전략                      | 사유                                                       |
| ---------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| `splitBarByWeeks`의 monthGrid            | **수동 구성**             | getMonthGrid 버그가 layout 테스트를 오염시키지 않도록 격리 |
| `computeWeekBars`의 weekDates            | **수동 Date[]**           | 7개 연속 Date를 직접 생성 (단순하여 격리 불필요)           |
| `layoutOverlappingSchedules`의 schedules | **makeScheduleItem** 헬퍼 | startAt/endAt만 변경                                       |

### DnD 이벤트 모킹

@dnd-kit의 `DragStartEvent` 등을 전체 모킹하지 않고, 테스트에 필요한 최소 shape만 plain object로 구성한 뒤 `as unknown as DragStartEvent`로 캐스팅.

### PointerEvent 시뮬레이션 (useScheduleResize)

- `React.PointerEvent`는 mock 객체 (`{ preventDefault: vi.fn(), clientY: N }`)
- `document.dispatchEvent(new PointerEvent('pointermove', { clientY: N }))` → happy-dom 지원
- `document.dispatchEvent(new PointerEvent('pointerup', { clientY: N }))` → onUp 트리거
- `removeEventListener` 호출 여부는 spy로 검증
- pointerup 이후 pointermove 무효 검증
