# Design: 캘린더 일간 뷰 시간 설정

> Plan: `docs/01-plan/features/calendar-dayview-time-settings.plan.md`

## 1. 설계 개요

설정 다이얼로그 디스플레이 탭에 "일정 > 일간 뷰 타임라인" 시작/끝 시간 설정을 추가한다.
하드코딩된 `START_HOUR = 6`을 사용자 설정 가능한 값으로 교체하고, 끝 시간(`END_HOUR`)도 설정 가능하게 한다.

## 2. 데이터 설계

### 2.1 설정 키 (app_settings 테이블)

| key                          | value type    | 범위  | 기본값 | 설명               |
| ---------------------------- | ------------- | ----- | ------ | ------------------ |
| `schedule.dayView.startHour` | string (숫자) | 0~12  | `"6"`  | 타임라인 시작 시간 |
| `schedule.dayView.endHour`   | string (숫자) | 12~24 | `"24"` | 타임라인 끝 시간   |

> app_settings는 key-value 텍스트 저장. 숫자는 `parseInt`로 파싱.

### 2.2 기본값 상수

```ts
// calendar-constants.ts
export const DEFAULT_START_HOUR = 6
export const DEFAULT_END_HOUR = 24
```

## 3. 설정 훅 설계

### 3.1 `useDayViewTimeSettings` (React Query 기반)

**위치**: `src/renderer/src/features/schedule/manage-schedule/model/use-day-view-time-settings.ts`

```ts
interface DayViewTimeSettings {
  startHour: number
  endHour: number
}

function useDayViewTimeSettings(): {
  settings: DayViewTimeSettings
  updateStartHour: (hour: number) => Promise<void>
  updateEndHour: (hour: number) => Promise<void>
}
```

**구현 상세:**

```ts
const SETTINGS_KEY = 'dayViewTime'

// Query: 두 설정값을 한번에 조회
const { data } = useQuery({
  queryKey: [SETTINGS_KEY],
  queryFn: async () => {
    const [startRes, endRes] = await Promise.all([
      window.api.settings.get('schedule.dayView.startHour'),
      window.api.settings.get('schedule.dayView.endHour')
    ])
    return {
      startHour:
        startRes.success && startRes.data ? parseInt(startRes.data, 10) : DEFAULT_START_HOUR,
      endHour: endRes.success && endRes.data ? parseInt(endRes.data, 10) : DEFAULT_END_HOUR
    }
  }
})

// 기본값 fallback (쿼리 로딩 중)
const settings: DayViewTimeSettings = data ?? {
  startHour: DEFAULT_START_HOUR,
  endHour: DEFAULT_END_HOUR
}

// Mutation: 변경 후 invalidate
const queryClient = useQueryClient()

async function updateStartHour(hour: number) {
  await window.api.settings.set('schedule.dayView.startHour', String(hour))
  queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] })
}

async function updateEndHour(hour: number) {
  await window.api.settings.set('schedule.dayView.endHour', String(hour))
  queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] })
}
```

## 4. calendar-time.ts 함수 파라미터화

### 4.1 변경 전 → 후

**`getTimeSlots()`**

```ts
// Before
export function getTimeSlots(): TimeSlot[] {
  return Array.from({ length: 24 - START_HOUR }, (_, i) => ({
    hour: START_HOUR + i,
    label: `${String(START_HOUR + i).padStart(2, '0')}:00`
  }))
}

// After
export function getTimeSlots(
  startHour: number = DEFAULT_START_HOUR,
  endHour: number = DEFAULT_END_HOUR
): TimeSlot[] {
  return Array.from({ length: endHour - startHour }, (_, i) => ({
    hour: startHour + i,
    label: `${String(startHour + i).padStart(2, '0')}:00`
  }))
}
```

**`timeToPosition()`**

```ts
// Before
export function timeToPosition(date: Date, hourHeight: number): number {
  return (date.getHours() - START_HOUR + date.getMinutes() / 60) * hourHeight
}

// After
export function timeToPosition(
  date: Date,
  hourHeight: number,
  startHour: number = DEFAULT_START_HOUR
): number {
  return (date.getHours() - startHour + date.getMinutes() / 60) * hourHeight
}
```

**`scheduleHeight()`** — 변경 없음 (startHour에 의존하지 않음).

### 4.2 calendar-utils.ts barrel export

```ts
// START_HOUR export 제거, DEFAULT_START_HOUR/DEFAULT_END_HOUR export 추가
export { DEFAULT_START_HOUR, DEFAULT_END_HOUR } from './calendar-constants'
```

## 5. 컴포넌트 수정

### 5.1 TimeGrid.tsx

**Props 변경:**

```ts
interface Props {
  hourHeight: number
  labelWidth: string
  labelClass: string
  startHour?: number // 추가
  endHour?: number // 추가
  showCurrentTime?: boolean
  onTimeClick?: (hour: number, minute: number) => void
  children: React.ReactNode
}
```

**내부 로직 변경:**

- `const slots = getTimeSlots(startHour, endHour)` — 파라미터 전달
- `const totalHeight = (endHour - startHour) * hourHeight`
- 스크롤 위치: `Math.max((now.getHours() - startHour - 1) * hourHeight, 0)`
- 가로선 top 계산: `(slot.hour - startHour) * hourHeight`
- `handleGridClick` 내 hour 계산: `startHour + Math.floor(totalMinutes / 60)`

### 5.2 CurrentTimeIndicator.tsx

**Props 변경:**

```ts
interface Props {
  hourHeight: number
  startHour?: number // 추가
}
```

**내부 로직:**

```ts
const top = timeToPosition(now, hourHeight, startHour)
```

### 5.3 DayView.tsx

**변경 사항:**

- `useDayViewTimeSettings()` 호출로 `startHour`, `endHour` 획득
- `<TimeGrid>` 에 `startHour={startHour}` `endHour={endHour}` 전달
- `timeToPosition`, `scheduleHeight` 호출 시 `startHour` 전달
- DnD preview, resize preview에서도 `startHour` 전달

### 5.4 ScheduleBlock.tsx

**변경 사항:**

- `startHour` prop 추가 (optional, default = DEFAULT_START_HOUR)
- `timeToPosition(effectiveStart, hourHeight, startHour)` — startHour 전달

## 6. 설정 UI 설계

### 6.1 DisplaySettings.tsx 수정

기존 테마 섹션 하단에 "일정" 섹션 추가.

```
┌─────────────────────────────────────┐
│ 테마                                │
│ [라이트]  [다크]                     │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ 일정                                │
│                                     │
│ 일간 뷰 타임라인                     │
│                                     │
│ 시작 시간   [▼ 06:00]              │
│ 끝 시간     [▼ 24:00]              │
└─────────────────────────────────────┘
```

### 6.2 Select 옵션

**시작 시간** (0~12):

```
00:00, 01:00, 02:00, ..., 12:00
```

**끝 시간** (12~24):

```
12:00, 13:00, ..., 23:00, 24:00
```

### 6.3 검증 로직

- 시작 시간 변경 시: `newStartHour < currentEndHour` 확인 (최소 1시간 차이)
- 끝 시간 변경 시: `currentStartHour < newEndHour` 확인 (최소 1시간 차이)
- 검증 실패 시 변경 무시 (Select 값 원복)

### 6.4 구현 코드 구조

```tsx
function ScheduleSettings(): React.JSX.Element {
  const { settings, updateStartHour, updateEndHour } = useDayViewTimeSettings()

  return (
    <div>
      <h3>일정</h3>
      <p className="text-sm text-muted-foreground">일간 뷰 타임라인</p>
      <div>
        <label>시작 시간</label>
        <Select value={String(settings.startHour)} onValueChange={...}>
          {/* 0~12 옵션 */}
        </Select>
      </div>
      <div>
        <label>끝 시간</label>
        <Select value={String(settings.endHour)} onValueChange={...}>
          {/* 12~24 옵션 */}
        </Select>
      </div>
    </div>
  )
}
```

## 7. 파일 변경 목록

| #   | 파일                                                                    | 변경 내용                                                    | 신규/수정 |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------ | --------- |
| 1   | `features/schedule/manage-schedule/model/calendar-constants.ts`         | `START_HOUR` → `DEFAULT_START_HOUR`, `DEFAULT_END_HOUR` 추가 | 수정      |
| 2   | `features/schedule/manage-schedule/model/calendar-time.ts`              | 함수 파라미터화 (startHour, endHour)                         | 수정      |
| 3   | `features/schedule/manage-schedule/model/calendar-utils.ts`             | barrel export 변경                                           | 수정      |
| 4   | `features/schedule/manage-schedule/model/use-day-view-time-settings.ts` | React Query 설정 훅                                          | 신규      |
| 5   | `features/schedule/manage-schedule/ui/TimeGrid.tsx`                     | startHour/endHour props 추가                                 | 수정      |
| 6   | `features/schedule/manage-schedule/ui/CurrentTimeIndicator.tsx`         | startHour prop 추가                                          | 수정      |
| 7   | `features/schedule/manage-schedule/ui/DayView.tsx`                      | 설정 훅 사용, props 전달                                     | 수정      |
| 8   | `features/schedule/manage-schedule/ui/ScheduleBlock.tsx`                | startHour prop 추가                                          | 수정      |
| 9   | `features/settings/manage-settings/ui/DisplaySettings.tsx`              | 일정 섹션 추가                                               | 수정      |

## 8. 구현 순서

1. **calendar-constants.ts** — `DEFAULT_START_HOUR`, `DEFAULT_END_HOUR` 정의
2. **calendar-time.ts** — 함수 파라미터 추가 (기본값으로 하위 호환)
3. **calendar-utils.ts** — barrel export 갱신
4. **use-day-view-time-settings.ts** — React Query 훅 신규 생성
5. **TimeGrid.tsx** — startHour/endHour props 추가 및 내부 로직 수정
6. **CurrentTimeIndicator.tsx** — startHour prop 추가
7. **ScheduleBlock.tsx** — startHour prop 추가
8. **DayView.tsx** — 훅 연결 및 하위 컴포넌트에 props 전달
9. **DisplaySettings.tsx** — 일정 섹션 UI 추가
