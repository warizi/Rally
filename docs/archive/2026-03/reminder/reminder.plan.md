# Plan: 알림(Reminder) 기능

## 개요

Todo와 일정(Schedule) 항목에 대해 사전 알림(Reminder)을 설정할 수 있는 기능. 지정된 시간 전에 Electron 데스크톱 알림을 통해 사용자에게 통지한다.

## 알림 옵션

| 옵션     | 오프셋(ms)  |
| -------- | ----------- |
| 10분 전  | 600,000     |
| 30분 전  | 1,800,000   |
| 1시간 전 | 3,600,000   |
| 1일 전   | 86,400,000  |
| 2일 전   | 172,800,000 |

## 적용 대상

- **Todo**: `dueDate` 또는 `startDate`가 설정된 경우에만 알림 설정 가능
- **Schedule**: `startAt` 기준으로 알림 설정 (항상 시간이 존재)

## 핵심 요구사항

### 1. 알림 설정 가능 조건

- Todo: `dueDate` 또는 `startDate` 중 하나 이상 설정되어야 알림 옵션 활성화
- Schedule: 항상 `startAt`이 있으므로 항상 알림 설정 가능
- 기준 시각: Todo는 `dueDate` 우선 (없으면 `startDate`), Schedule은 `startAt`
- Sub-Todo(하위 할일): 날짜 필드가 없으므로 알림 설정 불가 (`parentId`가 있으면 알림 UI 미표시)

### 2. allDay 일정의 알림 기준

- `allDay=true`인 일정의 `startAt`은 `00:00:00`으로 저장됨
- allDay 일정의 알림 기준 시각은 **당일 09:00**으로 환산하여 계산
  - 예: "1시간 전" → 당일 08:00 알림 (00:00 기준이 아닌 09:00 기준)
  - 예: "1일 전" → 전날 09:00 알림

### 3. UI 표시 위치

- **Todo 생성**: `CreateTodoDialog` — 날짜 필드 아래에 알림 선택 UI 추가 (Sub-Todo 제외)
- **Todo 상세**: `TodoDetailFields` — 알림 표시 및 수정 UI 추가
- **Schedule 생성/수정**: `ScheduleFormDialog` — 생성 + 수정 모두 동일 컴포넌트에서 알림 UI
- **Schedule 상세**: `ScheduleDetailPopover` — 알림 **표시만** (읽기 전용, 수정은 ScheduleFormDialog에서). 단, `isTodoItem(schedule)=true`인 항목(캘린더에 표시된 할일)은 알림 표시 제외

### 4. 알림 동작

- Electron `Notification` API를 사용한 데스크톱 알림
- 알림 클릭 시: 해당 항목의 탭을 열거나 포커스
- 앱이 실행 중일 때만 동작 (백그라운드 서비스 없음)

### 5. Todo 완료 시 알림 처리

- Todo의 완료 경로 3가지 모두에서 미발송 알림 자동 삭제 필요:
  1. **`todoService.update()`**: `isDone=true` 또는 `status='완료'` 변경 시
  2. **`todoService.reorderKanban()`**: 칸반 보드에서 '완료' 열로 드래그 시 — `bulkUpdateKanbanOrder()`가 직접 `isDone=true`를 설정하므로, `reorderKanban()` 내에서 완료 변경된 항목의 알림 삭제 호출 필요
  3. **부모 자동완료**: 모든 하위 Todo 완료 시 부모가 자동으로 `isDone=true`가 됨 — 부모의 알림도 삭제 필요
- 완료 후 다시 미완료로 변경해도 알림은 복원되지 않음 (재설정 필요)

### 6. Entity 삭제 시 알림 정리

- Todo 삭제 시: 해당 Todo + 모든 하위 Todo의 Reminder 삭제 (다형 참조이므로 DB CASCADE 불가, 서비스 레이어에서 명시적 삭제)
- Schedule 삭제 시: 해당 Schedule의 Reminder 삭제

### 7. Todo 날짜 제거 시 알림 처리

- `dueDate`와 `startDate` 모두 제거(null)되면 해당 Todo의 **모든 Reminder 삭제** (기준 시각이 없으므로 알림 불가)
- `dueDate`만 제거 시: `startDate` 기준으로 `remind_at` 재계산
- `startDate`만 제거 시: `dueDate` 기준으로 `remind_at` 재계산

### 8. Todo 생성 시 알림 설정 흐름

- `CreateTodoDialog`에서 알림 옵션을 선택하더라도, 실제 Reminder 생성은 Todo `create` 성공 후 `onSuccess` 콜백에서 별도 API 호출
- Entity Link 생성과 동일한 패턴: `createTodo.mutate(data, { onSuccess: (created) => { setReminder(...) } })`

## 기술 설계

### DB 스키마

```sql
-- reminders 테이블
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,          -- 'todo' | 'schedule'
  entity_id TEXT NOT NULL,            -- todo.id 또는 schedule.id
  offset_ms INTEGER NOT NULL,         -- 알림 오프셋 (밀리초)
  remind_at INTEGER NOT NULL,         -- 실제 알림 시각 (timestamp_ms)
  is_fired INTEGER NOT NULL DEFAULT 0, -- 발송 여부
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

> 참고: `entity_id`는 다형 참조(polymorphic)이므로 FK 제약조건 없음. 정합성은 서비스 레이어에서 보장.

### 알림 스케줄러 (Main Process)

- 앱 시작 시 & 주기적으로 (1분 간격) 미발송 알림 체크
- `remind_at <= now && is_fired = 0`인 알림 발송
- 발송 시 entity(todo/schedule)를 조회하여 제목(title) 획득
- 발송 후 `is_fired = 1`로 업데이트
- Todo/Schedule 시간 변경 시 `remind_at` 재계산 (+ `is_fired = 0`으로 리셋)
- 앱 종료 시(`before-quit`) 스케줄러 `clearInterval` 정리

### 알림 클릭 처리 (Main → Renderer IPC)

기존 프로젝트의 역방향 IPC 패턴 준수 (`workspace-watcher.ts` 참고):

- Main: `BrowserWindow.getAllWindows().forEach(win => win.webContents.send('reminder:fired', data))` — 기존 `pushNoteChanged` 등과 동일 패턴
- Preload: `onFired(callback)` — `ipcRenderer.on('reminder:fired', ...)` + `removeListener`로 cleanup 반환
- Renderer: `useReminderWatcher()` 훅을 앱 레벨(MainLayout 등)에서 등록 — 기존 `useNoteWatcher()` 패턴과 동일

### IPC API

```typescript
interface ReminderAPI {
  findByEntity: (
    entityType: 'todo' | 'schedule',
    entityId: string
  ) => Promise<IpcResponse<ReminderItem[]>>
  set: (data: SetReminderData) => Promise<IpcResponse<ReminderItem>>
  remove: (reminderId: string) => Promise<IpcResponse<void>>
  removeByEntity: (entityType: 'todo' | 'schedule', entityId: string) => Promise<IpcResponse<void>>
  onFired: (
    callback: (data: { entityType: string; entityId: string; title: string }) => void
  ) => () => void
}
```

### Renderer UI 컴포넌트

- `ReminderSelect`: 알림 옵션 드롭다운 (다중 선택 가능)
- 시간/기간 미설정 시 disabled 상태 + 툴팁 안내

### Renderer React Query 훅 (`@entities/reminder`)

- `useReminders(entityType, entityId)` — 조회
- `useSetReminder()` — 설정 mutation
- `useRemoveReminder()` — 삭제 mutation
- `useReminderWatcher()` — 앱 레벨 알림 수신 리스너 (MainLayout에서 등록)

## 구현 범위

### 포함

- reminders DB 테이블 및 마이그레이션
- reminder 서비스/리포지토리 (CRUD)
- IPC 핸들러 등록
- 알림 스케줄러 (setInterval 기반, 앱 종료 시 cleanup)
- Electron Notification 발송 + 클릭 시 탭 열기 (Main → Renderer IPC)
- Todo 생성/상세에 알림 UI (Sub-Todo 제외)
- Schedule 생성·수정/상세에 알림 UI (상세는 표시만, isTodoItem 제외)
- Todo/Schedule 시간 변경 시 remind_at 자동 재계산
- Todo 날짜 모두 제거 시 알림 삭제
- Todo 완료 시 미발송 알림 자동 삭제 (update, reorderKanban, 부모 자동완료 3경로 모두)
- Todo/Schedule 삭제 시 Reminder 정리
- allDay 일정은 09:00 기준으로 알림 시각 계산
- useReminderWatcher 훅 (앱 레벨 알림 수신)

### 제외

- 반복 알림 (매일, 매주 등)
- 커스텀 시간 입력
- 알림 히스토리/로그
- 앱 종료 후 알림 (OS 레벨 스케줄링)
- 알림음/사운드 커스터마이징

## 영향 범위

### 수정 파일

| 영역        | 파일                                             | 변경 내용                                                                                                                                       |
| ----------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema      | `src/main/db/schema/reminder.ts` (신규)          | reminders 테이블 정의                                                                                                                           |
| Schema      | `src/main/db/schema/index.ts`                    | reminder export 추가                                                                                                                            |
| Repository  | `src/main/repositories/reminder.ts` (신규)       | CRUD + findPending + removeByEntity + removeByEntities(배치)                                                                                    |
| Service     | `src/main/services/reminder.ts` (신규)           | 비즈니스 로직 + remind_at 계산 + allDay 09:00 보정                                                                                              |
| Service     | `src/main/services/todo.ts`                      | update: 시간 변경 재계산 + 날짜 제거 시 삭제 + 완료 시 삭제 + 부모 자동완료 시 삭제 / reorderKanban: 완료 항목 알림 삭제 / remove: 삭제 시 정리 |
| Service     | `src/main/services/schedule.ts`                  | update: 시간 변경 재계산 / remove: 삭제 시 정리                                                                                                 |
| Scheduler   | `src/main/services/reminder-scheduler.ts` (신규) | 1분 간격 체크 & entity 제목 조회 & Notification 발송 & cleanup                                                                                  |
| IPC         | `src/main/ipc/reminder.ts` (신규)                | IPC 핸들러                                                                                                                                      |
| IPC         | `src/main/index.ts`                              | registerReminderHandlers + 스케줄러 시작/정리 (before-quit)                                                                                     |
| Preload     | `src/preload/index.ts`                           | reminder API + onFired 리스너 추가                                                                                                              |
| Preload     | `src/preload/index.d.ts`                         | ReminderAPI + ReminderItem 타입 추가                                                                                                            |
| Entity      | `src/renderer/src/entities/reminder/` (신규)     | React Query 훅 + useReminderWatcher                                                                                                             |
| Feature     | `src/renderer/src/features/reminder/` (신규)     | ReminderSelect UI 컴포넌트                                                                                                                      |
| App         | MainLayout 또는 App 레벨                         | useReminderWatcher 등록                                                                                                                         |
| Todo UI     | `CreateTodoDialog.tsx`                           | 알림 선택 추가 (parentId 없을 때만, onSuccess에서 설정)                                                                                         |
| Todo UI     | `TodoDetailFields.tsx`                           | 알림 표시/수정 추가                                                                                                                             |
| Schedule UI | `ScheduleFormDialog.tsx`                         | 알림 선택 추가 (생성 + 수정 모두)                                                                                                               |
| Schedule UI | `ScheduleDetailPopover.tsx`                      | 알림 표시(읽기 전용, isTodoItem 제외) 추가                                                                                                      |

## 구현 순서

1. DB 스키마 + 마이그레이션
2. Repository + Service 레이어
3. IPC 핸들러 + Preload 브릿지 (역방향 IPC 포함)
4. 알림 스케줄러 + Electron Notification (Main Process)
5. Renderer Entity 훅 (`@entities/reminder`) + useReminderWatcher
6. Renderer UI 컴포넌트 (`ReminderSelect`)
7. Todo 생성/상세에 통합
8. Schedule 생성·수정/상세에 통합
9. Todo/Schedule 시간 변경·제거 시 remind_at 재계산/삭제 연동
10. Todo 완료 시 알림 삭제 연동 (update + reorderKanban + 부모 자동완료)
11. Todo/Schedule 삭제 시 알림 정리 연동

## 리스크

- **앱 미실행 시 알림 불가**: Electron 앱이 실행 중이어야 알림 가능. 별도 OS 서비스 없음.
- **과거 시간 알림**: 이미 지난 시간에 대한 알림은 발송하지 않음 (`remind_at > now` 체크)
- **다수 알림 동시 발송**: 1분 간격 체크이므로 동일 분에 여러 알림 가능 → 순차 발송
- **역방향 IPC**: `BrowserWindow.getAllWindows()`로 전체 윈도우에 전송. 윈도우가 없으면 발송 불가 (macOS에서 창 닫아도 앱은 유지되는 경우)
- **칸반 보드 완료**: `reorderKanban`은 repository에서 직접 isDone을 설정하므로, service 레벨에서 별도로 알림 삭제 로직 추가 필요
