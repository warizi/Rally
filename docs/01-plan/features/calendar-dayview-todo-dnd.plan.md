# 캘린더 일간뷰 Todo DnD (시간 수정) Plan

## Overview

캘린더 DayView에서 Todo 아이템에 DnD를 적용하여 시간을 수정할 수 있도록 한다.
현재 Todo는 날짜만 저장하고 시간 정보가 없어 DayView에서 06:00-07:00 고정 블록으로 표시되며 DnD가 비활성화되어 있다.
Todo의 시간 저장 방식을 스케줄과 동일하게 맞추고, DnD를 통한 시간 수정을 가능하게 한다.

---

## 현상 분석

### 1. 시간 저장 방식 비교

| 항목          | Schedule                            | Todo                                            |
| ------------- | ----------------------------------- | ----------------------------------------------- |
| 시간 필드     | `startAt` / `endAt` (full datetime) | `startDate` / `dueDate` (날짜만)                |
| DB 타입       | `timestamp_ms`                      | `timestamp_ms` (동일)                           |
| allDay 플래그 | `allDay: boolean` 명시적            | 없음 (항상 allDay로 취급)                       |
| 캘린더 변환   | 시간 그대로 사용                    | `startOfDay()` / `endOfDay()` 강제 적용         |
| DayView 표시  | 실제 시간으로 블록 배치             | 06:00-07:00 하드코딩                            |
| DnD           | 활성                                | **비활성** (`if (isTodoItem(schedule)) return`) |

### 2. "00시 23시 default" 문제

`CalendarPage.tsx`의 `todoToScheduleItem()`에서:

```ts
startAt: startOfDay(start),  // → 00:00:00
endAt: endOfDay(end),        // → 23:59:59
```

Todo에 시간 정보가 없으므로 무조건 하루 전체(00:00~23:59)로 변환됨.

### 3. DayView 하드코딩

`DayView.tsx`에서 todo는 시간이 없으므로 임의로 06:00-07:00 블록으로 표시:

```ts
if (isTodoItem(s)) {
  start.setHours(6, 0, 0, 0)
  end.setHours(7, 0, 0, 0)
}
```

---

## 핵심 설계 결정

### DB 스키마 변경 불필요

- `startDate`/`dueDate`는 이미 `timestamp_ms`로 저장 → 시간 정보 포함 가능
- 현재 application layer에서 시간을 무시하고 있는 것이 문제
- **기존 필드를 그대로 활용하되, 시간 정보까지 저장하도록 로직만 변경**

### Todo allDay 판별 로직

Todo에 `allDay` 컬럼을 추가하지 않고, 시간 값으로 판별:

- `startDate`의 시간이 00:00:00이고 `dueDate`의 시간이 23:59:59 → allDay
- 그 외 → 특정 시간대 블록으로 표시

### DnD로 시간 변경 시 동작

DayView에서 todo 블록을 드래그하면:

- allDay todo → timed todo로 자동 전환 (09:00-10:00 기본 1시간 블록으로 변환 후 이동)
- timed todo → 시간만 delta 적용

---

## 구현 범위

### Task 1: `todoToScheduleItem` 변환 로직 수정

**파일**: `src/renderer/src/pages/calendar/ui/CalendarPage.tsx`

현재:

```ts
allDay: true,
startAt: startOfDay(start),
endAt: endOfDay(end),
```

변경:

```ts
// 시간이 설정되어 있으면 (00:00/23:59가 아니면) timed로 취급
const isAllDay = isStartOfDay(start) && isEndOfDay(end)
allDay: isAllDay,
startAt: start,    // 시간 그대로 유지
endAt: end,        // 시간 그대로 유지
```

### Task 2: DayView에서 todo 하드코딩 제거 및 DnD 활성화

**파일**: `src/renderer/src/features/schedule/manage-schedule/ui/DayView.tsx`

- `clampMap`에서 todo 06:00-07:00 하드코딩 제거
- allDay todo는 기존 allDay 스케줄 섹션에 표시
- timed todo는 해당 시간대에 블록으로 표시
- `handleDragEnd`에서 `if (isTodoItem(schedule)) return` 제거
- todo DnD 시 `useUpdateTodo` mutation으로 시간 업데이트

### Task 3: Todo 시간 업데이트 mutation 추가

**파일**: `src/renderer/src/entities/todo/model/queries.ts`

기존 `useUpdateTodo`를 활용하여 DayView DnD에서 `startDate`/`dueDate` 시간 수정:

```ts
// DnD 완료 시
updateTodo.mutate({
  workspaceId,
  todoId: realTodoId, // 'todo:' prefix 제거
  data: { startDate: newStart, dueDate: newEnd }
})
```

### Task 4: Todo 생성/수정 시 default 시간 개선

**파일**: `src/renderer/src/features/todo/create-todo/ui/CreateTodoDialog.tsx`

현재 `DatePickerButton`은 날짜만 선택 → 시간 정보 00:00:00으로 고정됨.

변경:

- 시작일 선택 시 default 09:00으로 설정
- 마감일 선택 시 default 10:00으로 설정 (시작일과 같은 날이면)
- 다른 날이면 마감일 default 23:59:59 유지 (다일간 allDay)

### Task 5: WeekView/MonthView todo DnD 호환

**파일**: `WeekView.tsx`, `MonthView.tsx`

- todo를 DnD로 다른 날로 이동 시 시간 정보 보존
- `isTodoItem` 가드 수정하여 todo DnD도 처리

---

## 수정 대상 파일 요약

| 파일                                                                         | 변경 내용                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/renderer/src/pages/calendar/ui/CalendarPage.tsx`                        | `todoToScheduleItem` allDay 판별 로직, 시간 그대로 전달             |
| `src/renderer/src/features/schedule/manage-schedule/ui/DayView.tsx`          | todo 하드코딩 제거, DnD 가드 제거, todo DnD 시 `useUpdateTodo` 호출 |
| `src/renderer/src/features/schedule/manage-schedule/ui/WeekView.tsx`         | todo DnD 가드 수정                                                  |
| `src/renderer/src/features/schedule/manage-schedule/ui/MonthView.tsx`        | todo DnD 가드 수정                                                  |
| `src/renderer/src/features/todo/create-todo/ui/CreateTodoDialog.tsx`         | 시작일/마감일 default 시간 개선                                     |
| `src/renderer/src/features/schedule/manage-schedule/model/calendar-utils.ts` | `isAllDayTodo()` 헬퍼 함수 추가                                     |

---

## 구현 순서

1. `calendar-utils.ts` — `isAllDayTodo()` 헬퍼 추가
2. `CalendarPage.tsx` — `todoToScheduleItem` 변환 로직 수정
3. `DayView.tsx` — todo 하드코딩 제거 + DnD 활성화 + `useUpdateTodo` 연동
4. `CreateTodoDialog.tsx` — default 시간 개선
5. `WeekView.tsx` / `MonthView.tsx` — todo DnD 가드 수정
6. 수동 테스트: DayView에서 todo 드래그 → 시간 변경 확인

---

## 제약사항 / 주의점

- DB 스키마 변경 없음 — migration 불필요
- 기존 todo 데이터는 00:00/23:59 시간을 가지므로 allDay로 올바르게 판별됨
- `todo:` prefix ID 처리 주의 — DnD 시 `schedule.id.replace('todo:', '')` 필요
- resize(상하단 핸들)는 todo에 대해서도 활성화할지 결정 필요 → 우선 DnD(이동)만 적용
- `useMoveSchedule`은 schedule 전용 → todo는 `useUpdateTodo` 사용
