# Reminder Test Plan

> **Feature**: reminder-test
> **Date**: 2026-03-03
> **Status**: Draft

---

## 1. Overview

reminder 기능(Repository, Service, Scheduler)에 대한 단위 테스트 코드 작성.

### 1.1 Test Targets

| Target | File | Methods |
|--------|------|---------|
| reminderRepository | `src/main/repositories/reminder.ts` | findByEntity, findPending, findById, create, update, markFired, delete, deleteByEntity, deleteByEntities, deleteUnfiredByEntity |
| reminderService | `src/main/services/reminder.ts` | findByEntity, set, remove, removeByEntity, removeByEntities, removeUnfiredByEntity, recalculate, findPendingWithTitle, markFired |
| todo.ts 연동 | `src/main/services/todo.ts` | update (완료3경로 + 날짜변경), remove (하위 포함 삭제) |
| schedule.ts 연동 | `src/main/services/schedule.ts` | update (시간/allDay 변경), move (드래그), remove (삭제) |

### 1.2 Scope

- reminderRepository 10개 메서드 통합 테스트 (in-memory DB)
- reminderService 9개 메서드 단위 테스트 (repository 모킹)
- todo.ts의 reminderService 호출 검증 (기존 todo.test.ts에 mock 추가)
- schedule.ts의 reminderService 호출 검증 (schedule.test.ts **신규 생성** — 기존 파일 없음)
- IPC 핸들러는 `handle()` 래퍼로 동작하므로 별도 테스트 불필요
- Scheduler는 Electron `Notification` + `BrowserWindow` 의존이므로 이번 범위 제외

---

## 2. Test Cases

### 2.1 reminderRepository — `findByEntity` (3 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | entity에 알림 2개 존재 | 2개 배열 반환 |
| 2 | entity에 알림 없음 | 빈 배열 |
| 3 | 다른 entityType의 동일 entityId | 해당 타입만 반환 |

### 2.2 reminderRepository — `findPending` (3 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | remindAt <= now, isFired=false | 해당 알림 반환 |
| 2 | remindAt > now | 미반환 |
| 3 | remindAt <= now, isFired=true | 미반환 (이미 발송) |

### 2.3 reminderRepository — `findById` (2 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | 존재하는 ID | Reminder 반환 |
| 2 | 없는 ID | undefined |

### 2.4 reminderRepository — `create` (1 case)

| # | Case | Expected |
|---|------|----------|
| 1 | 모든 필드 포함 생성 | returning()으로 생성된 행 반환 |

### 2.5 reminderRepository — `update` (2 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | remindAt + isFired 부분 업데이트 | 변경된 값 반환 |
| 2 | 존재하지 않는 ID | undefined |

### 2.6 reminderRepository — `markFired` (1 case)

| # | Case | Expected |
|---|------|----------|
| 1 | isFired=false → true 전환 | isFired=true, updatedAt 갱신 |

### 2.7 reminderRepository — `delete` (1 case)

| # | Case | Expected |
|---|------|----------|
| 1 | 삭제 후 findById | undefined |

### 2.8 reminderRepository — `deleteByEntity` (2 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | entity 알림 3개 → 전부 삭제 | findByEntity 빈 배열 |
| 2 | 다른 entity 알림은 유지 | 다른 entity 알림 건재 |

### 2.9 reminderRepository — `deleteByEntities` (2 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | entityIds 2개, 각 알림 2개 → 4개 전부 삭제 | 모두 삭제 확인 |
| 2 | 빈 배열 전달 | 아무것도 삭제하지 않음 |

### 2.10 reminderRepository — `deleteUnfiredByEntity` (2 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | fired 1개 + unfired 2개 → unfired만 삭제 | fired 1개만 남음 |
| 2 | 전부 fired → 삭제 없음 | 전부 유지 |

**Repository 소계: 22 cases**

---

### 2.11 reminderService — `findByEntity` (1 case)

| # | Case | Expected |
|---|------|----------|
| 1 | repo 반환값을 ReminderItem으로 변환 | Date 변환 확인 |

### 2.12 reminderService — `set` (10 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | 정상 생성 (유효 offset, 미래 시각) | ReminderItem 반환, create 호출 |
| 2 | 유효하지 않은 offset (15분) | ValidationError throw |
| 3 | entity 없음 (getBaseTime null) | NotFoundError throw |
| 4 | 과거 시각 (baseTime이 이미 지남) | ValidationError throw |
| 5 | 동일 entity+offset 중복 → update | create 미호출, update 호출 |
| 6 | todo: dueDate 우선 (dueDate > startDate) | dueDate 기반 remindAt |
| 7 | schedule allDay: 09:00 보정 | 00:00→09:00 기반 remindAt |
| 8 | todo: startDate만 존재 (dueDate 없음) | startDate 기반 remindAt (`dueDate ?? startDate` 분기) |
| 9 | 중복 + isFired=true인 기존 알림 → update | isFired=false 리셋 확인 |
| 10 | schedule non-allDay → startAt 그대로 사용 | 09:00 보정 없이 startAt 기반 remindAt |

### 2.13 reminderService — `remove` (2 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | 존재하는 알림 삭제 | repo.delete 호출 |
| 2 | 없는 알림 | NotFoundError throw |

### 2.14 reminderService — `removeByEntity` (1 case)

| # | Case | Expected |
|---|------|----------|
| 1 | repo.deleteByEntity 호출 확인 | entityType, entityId 전달 |

### 2.15 reminderService — `removeByEntities` (1 case)

| # | Case | Expected |
|---|------|----------|
| 1 | repo.deleteByEntities 호출 확인 | entityType, entityIds 전달 |

### 2.16 reminderService — `removeUnfiredByEntity` (1 case)

| # | Case | Expected |
|---|------|----------|
| 1 | repo.deleteUnfiredByEntity 호출 확인 | entityType, entityId 전달 |

### 2.17 reminderService — `recalculate` (3 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | baseTime 존재 → 각 알림 remindAt 재계산 | update 호출, isFired=false 리셋 |
| 2 | baseTime null (날짜 모두 제거) → 전체 삭제 | deleteByEntity 호출 |
| 3 | 알림 2개 존재 → 각각 update | update 2회 호출 |

### 2.18 reminderService — `findPendingWithTitle` (3 cases)

| # | Case | Expected |
|---|------|----------|
| 1 | todo 알림 → todo.title 포함 | title 필드 확인 |
| 2 | schedule 알림 → schedule.title 포함 | title 필드 확인 |
| 3 | 삭제된 entity → 폴백 제목 | '(삭제된 할 일)' 또는 '(삭제된 일정)' |

### 2.19 reminderService — `markFired` (1 case)

| # | Case | Expected |
|---|------|----------|
| 1 | repo.markFired 호출 | reminderId, Date 전달 |

**Service 소계: 23 cases**

---

### 2.20 todo.ts 연동 (기존 todo.test.ts에 mock 추가 후 케이스 추가, 10 cases)

> **주의**: todo.test.ts에 `reminderService` mock과 `canvasNodeRepository` mock이 현재 없음.
> 기존 테스트가 깨지지 않도록 mock 기본값을 no-op으로 설정 후 케이스 추가.

| # | Case | Expected |
|---|------|----------|
| 1 | update isDone=true → removeUnfiredByEntity('todo', id) | 호출 확인 |
| 2 | update dueDate 변경 → recalculate('todo', id) | 호출 확인 |
| 3 | update dueDate+startDate 모두 null → removeByEntity | 호출 확인 |
| 4 | update isDone=true + dueDate 변경 → recalculate 미호출 | isDone 가드 검증 |
| 5 | update 부모 자동완료 → removeUnfiredByEntity('todo', parentId) | 부모 알림 삭제 |
| 6 | reorderKanban 완료 이동 → removeUnfiredByEntity | 완료 항목만 호출 |
| 7 | remove → removeByEntities('todo', [id, ...subtodoIds]) | 하위 포함 삭제 |
| 8 | update startDate만 변경 (dueDate 미변경) → recalculate 호출 | `data.startDate !== undefined` 분기 |
| 9 | update status='완료' → removeUnfiredByEntity 호출 | resolveDoneFields 경유 isDone=true 확인 |
| 10 | reorderKanban 혼합 status (할일+완료) → 완료만 알림 삭제 | 할일 항목은 미호출 (negative) |

### 2.21 schedule.ts 연동 (**신규** schedule.test.ts 생성, 6 cases)

> **주의**: `schedule.test.ts`가 존재하지 않음 → 새 파일 생성 필요.
> scheduleService 전체를 테스트하지 않고, reminder 연동 부분만 검증하는 최소 테스트.

| # | Case | Expected |
|---|------|----------|
| 1 | update startAt 변경 → recalculate('schedule', id) | 호출 확인 |
| 2 | update allDay 변경 → recalculate | 호출 확인 |
| 3 | move → recalculate('schedule', id) | 호출 확인 |
| 4 | remove → removeByEntity('schedule', id) | 삭제 전 호출 확인 |
| 5 | update title만 변경 → recalculate 미호출 | 시간/allDay 미변경 시 (negative) |
| 6 | update endAt만 변경 → recalculate 미호출 | endAt은 트리거 조건 아님 (negative) |

**연동 소계: 16 cases**

---

## 3. Test Files

| File | Target | Est. Cases |
|------|--------|:----------:|
| `src/main/repositories/__tests__/reminder.test.ts` | reminderRepository 10개 메서드 (신규) | 22 |
| `src/main/services/__tests__/reminder.test.ts` | reminderService 9개 메서드 (신규) | 23 |
| `src/main/services/__tests__/todo.test.ts` | update/reorderKanban/remove 알림 연동 (**기존 파일에 mock+케이스 추가**) | 10 |
| `src/main/services/__tests__/schedule.test.ts` | update/move/remove 알림 연동 (**신규 파일 생성**) | 6 |
| **Total** | | **61** |

---

## 4. Mocking Strategy

```
== Repository 테스트 (통합) ==
실제 in-memory DB (testDb) 사용 — setup.ts가 제공하는 마이그레이션 환경
testDb.insert(schema.reminders).values(...) 로 테스트 데이터 삽입

== Service 테스트 (단위) ==
vi.mock('../../repositories/reminder')  — reminderRepository 전체 모킹
vi.mock('../../repositories/todo')      — todoRepository.findById 모킹
vi.mock('../../repositories/schedule')  — scheduleRepository.findById 모킹
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' })) — 고정 ID

== todo.test.ts (기존 파일에 mock 추가) ==
vi.mock('../reminder')  — reminderService 전체 모킹 (4 메서드 no-op 기본값)
vi.mock('../../repositories/canvas-node')  — canvasNodeRepository 모킹 (deleteByRef no-op)
⚠️ 위 2개 mock이 없으면 기존 30+ 테스트 전부 실패 (import 시 실제 모듈 로딩 시도)

== schedule.test.ts (신규 생성) ==
vi.mock('../reminder')               — reminderService 전체 모킹
vi.mock('../../repositories/schedule')— scheduleRepository 모킹
vi.mock('../../repositories/workspace')— workspaceRepository 모킹
vi.mock('../../repositories/schedule-todo') — scheduleTodoRepository 모킹
vi.mock('../../repositories/todo')    — todoRepository 모킹
vi.mock('../entity-link')             — entityLinkService 모킹
vi.mock('../../repositories/canvas-node') — canvasNodeRepository 모킹
vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' })) — 고정 ID
```

---

## 5. Non-Functional Requirements

- 기존 테스트 패턴 (vi.mock, beforeEach clearAllMocks) 준수
- VALID_OFFSETS 5개 값 중 대표 1개(10분)로 정상 경로, 15분으로 비정상 경로 검증
- Date 비교는 `getTime()` 사용 (timestamp 정밀도)
- 한글 테스트 설명 (`it('조건 — 기대결과')`) 패턴 유지
- Scheduler 테스트는 Electron Notification/BrowserWindow 모킹 필요 → 이번 범위 제외

---

## 6. Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| setup.ts에 reminders 테이블 초기화 누락 | 테스트 격리 실패 | beforeEach에 `testDb.delete(schema.reminders).run()` 추가 |
| todo.test.ts에 reminderService mock 추가 시 기존 테스트 영향 | 기존 30+ 테스트 실패 | 모든 메서드 no-op `vi.fn()` 기본값 설정 |
| todo.test.ts에 canvasNodeRepository mock 누락 | 기존 remove 테스트 5개 실패 | `vi.mock('../../repositories/canvas-node')` 추가 필수 |
| schedule.test.ts 부재 | 기존 파일 추가 불가 | 신규 파일 생성 (schedule 전체 mock 구성 필요) |
| timestamp_ms 모드의 Date↔number 변환 | 비교 오류 | `instanceof Date` 분기 + `getTime()` 사용 |
