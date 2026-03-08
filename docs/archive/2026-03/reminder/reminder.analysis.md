# Reminder Gap Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Rally
> **Analyst**: gap-detector
> **Date**: 2026-03-03
> **Design Doc**: [reminder.design.md](../02-design/features/reminder.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Compare the reminder feature design document (13 sections, 23 files) against the actual implementation to verify correctness and completeness.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/reminder.design.md` (Section 1-13, 21 checklist items)
- **Implementation Files**: 23 files across main process, preload, and renderer
- **Analysis Date**: 2026-03-03

---

## 2. Overall Scores

| Category                |  Score   |  Status  |
| ----------------------- | :------: | :------: |
| Design Match            |   100%   |   PASS   |
| Architecture Compliance |   100%   |   PASS   |
| Convention Compliance   |   100%   |   PASS   |
| **Overall**             | **100%** | **PASS** |

---

## 3. Section-by-Section Verification

### 3.1 DB Schema (Design Section 1)

**File**: `src/main/db/schema/reminder.ts`

| Item                  | Design                                                              | Implementation                                                      | Status |
| --------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| Table name            | `reminders`                                                         | `reminders`                                                         | MATCH  |
| id                    | `text('id').primaryKey()`                                           | `text('id').primaryKey()`                                           | MATCH  |
| entityType            | `text('entity_type', { enum: ['todo', 'schedule'] }).notNull()`     | `text('entity_type', { enum: ['todo', 'schedule'] }).notNull()`     | MATCH  |
| entityId              | `text('entity_id').notNull()`                                       | `text('entity_id').notNull()`                                       | MATCH  |
| offsetMs              | `integer('offset_ms').notNull()`                                    | `integer('offset_ms').notNull()`                                    | MATCH  |
| remindAt              | `integer('remind_at', { mode: 'timestamp_ms' }).notNull()`          | `integer('remind_at', { mode: 'timestamp_ms' }).notNull()`          | MATCH  |
| isFired               | `integer('is_fired', { mode: 'boolean' }).notNull().default(false)` | `integer('is_fired', { mode: 'boolean' }).notNull().default(false)` | MATCH  |
| createdAt             | `integer('created_at', { mode: 'timestamp_ms' }).notNull()`         | `integer('created_at', { mode: 'timestamp_ms' }).notNull()`         | MATCH  |
| updatedAt             | `integer('updated_at', { mode: 'timestamp_ms' }).notNull()`         | `integer('updated_at', { mode: 'timestamp_ms' }).notNull()`         | MATCH  |
| idx_reminders_entity  | `on(table.entityType, table.entityId)`                              | `on(table.entityType, table.entityId)`                              | MATCH  |
| idx_reminders_pending | `on(table.isFired, table.remindAt)`                                 | `on(table.isFired, table.remindAt)`                                 | MATCH  |

**File**: `src/main/db/schema/index.ts`

| Item             | Design                                   | Implementation                                    | Status |
| ---------------- | ---------------------------------------- | ------------------------------------------------- | ------ |
| Import reminders | `import { reminders } from './reminder'` | Line 18: `import { reminders } from './reminder'` | MATCH  |
| Export reminders | `export { ..., reminders }`              | Line 38: `reminders` in export block              | MATCH  |

**Section 1 Result**: 13/13 items MATCH

---

### 3.2 Repository (Design Section 2)

**File**: `src/main/repositories/reminder.ts`

| Method                | Design Signature                                                 | Implementation                                                             | Status   |
| --------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| Type exports          | `Reminder`, `ReminderInsert`                                     | Lines 5-6: both exported                                                   | MATCH    |
| findByEntity          | `(entityType: string, entityId: string): Reminder[]`             | Line 9: `(entityType: 'todo' \| 'schedule', entityId: string): Reminder[]` | COSMETIC |
| findPending           | `(now: Date): Reminder[]`                                        | Line 17: exact match                                                       | MATCH    |
| findById              | `(id: string): Reminder \| undefined`                            | Line 25: exact match                                                       | MATCH    |
| create                | `(data: ReminderInsert): Reminder`                               | Line 29: exact match                                                       | MATCH    |
| update                | `(id: string, data: Partial<Pick<...>>): Reminder \| undefined`  | Lines 33-37: exact match                                                   | MATCH    |
| markFired             | `(id: string, now: Date): void`                                  | Lines 40-45: exact match                                                   | MATCH    |
| delete                | `(id: string): void`                                             | Lines 47-49: exact match                                                   | MATCH    |
| deleteByEntity        | `(entityType: string, entityId: string): void`                   | Lines 51-55: typed as `'todo' \| 'schedule'`                               | COSMETIC |
| deleteByEntities      | `(entityType: string, entityIds: string[]): void` with CHUNK=900 | Lines 57-66: CHUNK=900, same logic                                         | MATCH    |
| deleteUnfiredByEntity | `(entityType: string, entityId: string): void`                   | Lines 68-78: typed as `'todo' \| 'schedule'`                               | COSMETIC |

**Cosmetic Diffs (3)**: Implementation uses stricter union type `'todo' | 'schedule'` instead of `string` for entityType parameters in `findByEntity`, `deleteByEntity`, `deleteUnfiredByEntity`. This is a type safety improvement, not a functional gap.

**Section 2 Result**: 11/11 items MATCH (3 cosmetic type-narrowing improvements)

---

### 3.3 Service (Design Section 3)

**File**: `src/main/services/reminder.ts`

| Item                      | Design                                                    | Implementation                   | Status |
| ------------------------- | --------------------------------------------------------- | -------------------------------- | ------ |
| VALID_OFFSETS             | 5 values: 10min, 30min, 1h, 1d, 2d                        | Lines 10-16: exact same 5 values | MATCH  |
| ReminderItem interface    | 8 fields                                                  | Lines 20-29: exact match         | MATCH  |
| SetReminderData interface | 3 fields                                                  | Lines 31-35: exact match         | MATCH  |
| toReminderItem mapper     | Date coercion logic                                       | Lines 39-50: exact match         | MATCH  |
| getBaseTime function      | todo: dueDate ?? startDate, schedule: allDay 09:00 adjust | Lines 56-81: exact match         | MATCH  |
| calcRemindAt              | `baseTime.getTime() - offsetMs`                           | Lines 83-85: exact match         | MATCH  |
| findByEntity              | maps through toReminderItem                               | Lines 90-92: exact match         | MATCH  |
| set - offset validation   | `VALID_OFFSETS.has(data.offsetMs)`                        | Lines 96-98: exact match         | MATCH  |
| set - baseTime not found  | throws NotFoundError                                      | Lines 100-103: exact match       | MATCH  |
| set - past time rejection | `remindAt <= now` throws ValidationError                  | Lines 109-111: exact match       | MATCH  |
| set - duplicate detection | findByEntity + find by offsetMs                           | Lines 114-124: exact match       | MATCH  |
| set - duplicate update    | update remindAt + isFired: false                          | Lines 118-123: exact match       | MATCH  |
| set - new create          | nanoid, all fields                                        | Lines 126-137: exact match       | MATCH  |
| remove                    | findById check + delete                                   | Lines 140-143: exact match       | MATCH  |
| removeByEntity            | delegates to repository                                   | Lines 146-148: exact match       | MATCH  |
| removeByEntities          | delegates to repository                                   | Lines 150-152: exact match       | MATCH  |
| removeUnfiredByEntity     | delegates to repository                                   | Lines 154-157: exact match       | MATCH  |
| recalculate - no baseTime | deleteByEntity fallback                                   | Lines 160-165: exact match       | MATCH  |
| recalculate - recalc loop | update remindAt + isFired: false                          | Lines 168-177: exact match       | MATCH  |
| findPendingWithTitle      | todo/schedule title lookup                                | Lines 181-198: exact match       | MATCH  |
| markFired                 | delegates to repository                                   | Lines 200-202: exact match       | MATCH  |

**Cosmetic Diff (1)**: `EntityType` type alias (`type EntityType = 'todo' | 'schedule'`) added at line 54 and used in method signatures instead of bare `string`. This is a type safety improvement.

**Section 3 Result**: 21/21 items MATCH (1 cosmetic type alias addition)

---

### 3.4 IPC Handler (Design Section 4)

**File**: `src/main/ipc/reminder.ts`

| Handler                 | Design Channel                                                       | Implementation                     | Status |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------- | ------ |
| Function name           | `registerReminderHandlers`                                           | Line 7: `registerReminderHandlers` | MATCH  |
| reminder:findByEntity   | `handle(() => reminderService.findByEntity(entityType, entityId))`   | Lines 8-12: exact match            | MATCH  |
| reminder:set            | `handle(() => reminderService.set(data))`                            | Lines 14-17: exact match           | MATCH  |
| reminder:remove         | `handle(() => reminderService.remove(reminderId))`                   | Lines 20-23: exact match           | MATCH  |
| reminder:removeByEntity | `handle(() => reminderService.removeByEntity(entityType, entityId))` | Lines 26-30: exact match           | MATCH  |

**Cosmetic Diff (1)**: IPC handler entityType parameters typed as `'todo' | 'schedule'` instead of `string` (consistent with the stricter repository types).

**Section 4 Result**: 5/5 items MATCH

---

### 3.5 Reminder Scheduler (Design Section 5)

**File**: `src/main/services/reminder-scheduler.ts`

| Item                        | Design                                                                               | Implementation           | Status |
| --------------------------- | ------------------------------------------------------------------------------------ | ------------------------ | ------ |
| CHECK_INTERVAL              | `60_000` (1 min)                                                                     | Line 4: `60_000`         | MATCH  |
| STALE_THRESHOLD             | `5 * 60_000` (5 min)                                                                 | Line 5: `5 * 60_000`     | MATCH  |
| intervalId type             | `ReturnType<typeof setInterval> \| null`                                             | Line 7: exact match      | MATCH  |
| checkAndFire - stale filter | `now - remindAt > STALE_THRESHOLD` -> markFired + continue                           | Lines 15-18: exact match | MATCH  |
| Notification title          | todo: '할 일 알림', schedule: '일정 알림'                                            | Lines 21-24: exact match | MATCH  |
| Notification body           | `item.title`                                                                         | Line 23: exact match     | MATCH  |
| click - send to all windows | `BrowserWindow.getAllWindows().forEach(win.webContents.send('reminder:fired', ...))` | Lines 28-34: exact match | MATCH  |
| click - focus first window  | restore if minimized + focus                                                         | Lines 36-40: exact match | MATCH  |
| notification.show()         | called after click handler setup                                                     | Line 43: exact match     | MATCH  |
| markFired after show        | `reminderService.markFired(item.id)`                                                 | Line 46: exact match     | MATCH  |
| start()                     | guard against duplicate, immediate check, setInterval                                | Lines 51-55: exact match | MATCH  |
| stop()                      | clearInterval + null                                                                 | Lines 57-63: exact match | MATCH  |

**Section 5 Result**: 12/12 items MATCH

---

### 3.6 index.ts Registration (Design Section 6)

**File**: `src/main/index.ts`

| Item                            | Design                                                          | Implementation                               | Status |
| ------------------------------- | --------------------------------------------------------------- | -------------------------------------------- | ------ |
| Import registerReminderHandlers | `from './ipc/reminder'`                                         | Line 23: exact match                         | MATCH  |
| Import reminderScheduler        | `from './services/reminder-scheduler'`                          | Line 24: exact match                         | MATCH  |
| registerReminderHandlers() call | inside app.whenReady                                            | Line 107: called after other handlers        | MATCH  |
| reminderScheduler.start()       | after createWindow()                                            | Line 111: after `createWindow()` at line 109 | MATCH  |
| reminderScheduler.stop()        | in before-quit handler                                          | Line 131: `reminderScheduler.stop()`         | MATCH  |
| before-quit flow                | stop -> flushStorageData -> race[watcher.stop, timeout] -> quit | Lines 127-136: exact match                   | MATCH  |

**Section 6 Result**: 6/6 items MATCH

---

### 3.7 Preload Bridge (Design Section 7)

**File**: `src/preload/index.ts`

| Item                    | Design                                                                | Implementation             | Status |
| ----------------------- | --------------------------------------------------------------------- | -------------------------- | ------ |
| reminder.findByEntity   | `ipcRenderer.invoke('reminder:findByEntity', entityType, entityId)`   | Lines 272-273: exact match | MATCH  |
| reminder.set            | `ipcRenderer.invoke('reminder:set', data)`                            | Line 274: exact match      | MATCH  |
| reminder.remove         | `ipcRenderer.invoke('reminder:remove', reminderId)`                   | Line 275: exact match      | MATCH  |
| reminder.removeByEntity | `ipcRenderer.invoke('reminder:removeByEntity', entityType, entityId)` | Lines 276-277: exact match | MATCH  |
| reminder.onFired        | `ipcRenderer.on('reminder:fired', handler)` + return cleanup          | Lines 278-287: exact match | MATCH  |

**File**: `src/preload/index.d.ts`

| Item                      | Design                      | Implementation                    | Status |
| ------------------------- | --------------------------- | --------------------------------- | ------ |
| ReminderItem interface    | 8 fields with correct types | Lines 526-535: exact match        | MATCH  |
| SetReminderData interface | 3 fields                    | Lines 537-541: exact match        | MATCH  |
| ReminderAPI interface     | 5 methods                   | Lines 543-557: exact match        | MATCH  |
| API.reminder field        | `reminder: ReminderAPI`     | Line 576: `reminder: ReminderAPI` | MATCH  |

**Section 7 Result**: 9/9 items MATCH

---

### 3.8 Renderer - entities/reminder (Design Section 8)

**File**: `src/renderer/src/entities/reminder/model/types.ts`

| Item                      | Design                       | Implementation           | Status |
| ------------------------- | ---------------------------- | ------------------------ | ------ |
| ReminderItem interface    | 8 fields                     | Lines 1-10: exact match  | MATCH  |
| SetReminderData interface | 3 fields                     | Lines 12-16: exact match | MATCH  |
| REMINDER_OFFSETS          | 5 entries with labels/values | Lines 18-24: exact match | MATCH  |

**File**: `src/renderer/src/entities/reminder/model/queries.ts`

| Item              | Design                                                                       | Implementation           | Status |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------ | ------ |
| REMINDER_KEY      | `'reminder'`                                                                 | Line 12: exact match     | MATCH  |
| useReminders      | params: `entityType \| null`, `entityId \| null \| undefined`, enabled guard | Lines 14-30: exact match | MATCH  |
| useSetReminder    | mutationFn + onSuccess invalidation                                          | Lines 32-50: exact match | MATCH  |
| useRemoveReminder | params include entityType/entityId for invalidation                          | Lines 52-69: exact match | MATCH  |

**File**: `src/renderer/src/entities/reminder/index.ts`

| Item                    | Design                                                | Implementation      | Status |
| ----------------------- | ----------------------------------------------------- | ------------------- | ------ |
| Type exports            | `ReminderItem`, `SetReminderData`                     | Line 1: exact match | MATCH  |
| REMINDER_OFFSETS export | from `./model/types`                                  | Line 2: exact match | MATCH  |
| Hook exports            | `useReminders`, `useSetReminder`, `useRemoveReminder` | Line 3: exact match | MATCH  |

**Section 8 Result**: 10/10 items MATCH

---

### 3.9 Renderer - features/reminder UI (Design Section 9)

**File**: `src/renderer/src/features/reminder/ui/ReminderSelect.tsx`

| Item                 | Design                                          | Implementation                                  | Status |
| -------------------- | ----------------------------------------------- | ----------------------------------------------- | ------ |
| Props interface      | entityType, entityId, disabled?                 | Lines 8-12: exact match                         | MATCH  |
| reminderByOffset Map | `new Map(reminders.map(r => [r.offsetMs, r]))`  | Lines 20-22: exact match (with type annotation) | MATCH  |
| activeCount          | `reminders.filter(r => !r.isFired).length`      | Line 24: exact match                            | MATCH  |
| handleToggle         | checked -> set, unchecked -> remove             | Lines 26-35: exact match                        | MATCH  |
| Button display       | `activeCount > 0 ? activeCount + '개' : '알림'` | Line 47: exact match                            | MATCH  |
| Fired state display  | `line-through` + `text-muted-foreground` CSS    | Line 59: exact match                            | MATCH  |
| "발송됨" label       | `<span>` with text-xs when isFired              | Line 66: exact match                            | MATCH  |

**File**: `src/renderer/src/features/reminder/ui/ReminderPendingSelect.tsx`

| Item            | Design                                                  | Implementation              | Status |
| --------------- | ------------------------------------------------------- | --------------------------- | ------ |
| Props interface | selected: number[], onChange, disabled?                 | Lines 8-11: exact match     | MATCH  |
| activeSet       | `new Set(selected)`                                     | Line 15: exact match        | MATCH  |
| handleToggle    | checked -> add, unchecked -> filter out                 | Lines 17-22: exact match    | MATCH  |
| Button display  | `selected.length > 0 ? selected.length + '개' : '알림'` | Line 30: exact match        | MATCH  |
| No fired state  | No line-through or "발송됨"                             | Correct: no fired rendering | MATCH  |

**File**: `src/renderer/src/features/reminder/model/use-reminder-watcher.ts`

| Item                     | Design                                                  | Implementation               | Status |
| ------------------------ | ------------------------------------------------------- | ---------------------------- | ------ |
| openTab from useTabStore | `useTabStore(s => s.openTab)`                           | Line 7: exact match          | MATCH  |
| onFired subscription     | `window.api.reminder.onFired(...)`                      | Line 10: exact match         | MATCH  |
| todo mapping             | `{ type: 'todo-detail', pathname: '/todo/{entityId}' }` | Line 13: exact match         | MATCH  |
| schedule mapping         | null -> open calendar tab                               | Lines 14, 20-21: exact match | MATCH  |
| Cleanup return           | `return unsub`                                          | Line 25: exact match         | MATCH  |
| Dependency array         | `[openTab]`                                             | Line 26: exact match         | MATCH  |

**File**: `src/renderer/src/features/reminder/index.ts`

| Item                         | Design                              | Implementation      | Status |
| ---------------------------- | ----------------------------------- | ------------------- | ------ |
| ReminderSelect export        | from `./ui/ReminderSelect`          | Line 1: exact match | MATCH  |
| ReminderPendingSelect export | from `./ui/ReminderPendingSelect`   | Line 2: exact match | MATCH  |
| useReminderWatcher export    | from `./model/use-reminder-watcher` | Line 3: exact match | MATCH  |

**Section 9 Result**: 20/20 items MATCH

---

### 3.10 Todo Integration (Design Section 10)

**File**: `src/renderer/src/features/todo/create-todo/ui/CreateTodoDialog.tsx`

| Item                           | Design                                                          | Implementation                        | Status |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------------- | ------ |
| pendingReminders state         | `useState<number[]>([])`                                        | Line 44: exact match                  | MATCH  |
| Import ReminderPendingSelect   | from `@features/reminder`                                       | Line 13: exact match                  | MATCH  |
| Import useSetReminder          | from `@entities/reminder`                                       | Line 14: exact match                  | MATCH  |
| handleOpenChange reset         | `setPendingReminders([])`                                       | Line 76: exact match                  | MATCH  |
| startDate change: date removed | `if (!v && !dueDate) setPendingReminders([])`                   | Line 200: exact match                 | MATCH  |
| dueDate change: date removed   | `if (!v && !startDate) setPendingReminders([])`                 | Line 215: exact match                 | MATCH  |
| Conditional rendering          | `!titleOnly && (startDate \|\| dueDate)`                        | Line 223: exact match                 | MATCH  |
| ReminderPendingSelect props    | `selected={pendingReminders} onChange={setPendingReminders}`    | Lines 227-228: exact match            | MATCH  |
| onSuccess reminder calls       | `pendingReminders.forEach(offsetMs => setReminder.mutate(...))` | Lines 152-159: exact match (for loop) | MATCH  |
| onSuccess reset                | `setPendingReminders([])`                                       | Line 165: exact match                 | MATCH  |

**File**: `src/renderer/src/widgets/todo/ui/TodoDetailFields.tsx`

| Item                     | Design                             | Implementation                         | Status |
| ------------------------ | ---------------------------------- | -------------------------------------- | ------ |
| Import ReminderSelect    | from `@features/reminder`          | Line 7: exact match                    | MATCH  |
| ReminderSelect placement | below startDate/dueDate            | Lines 79-88: in a grid row after dates | MATCH  |
| entityType prop          | `"todo"`                           | Line 83: exact match                   | MATCH  |
| entityId prop            | `todo.id`                          | Line 84: exact match                   | MATCH  |
| disabled condition       | `!todo.dueDate && !todo.startDate` | Line 85: exact match                   | MATCH  |

**Section 10 Result**: 15/15 items MATCH

---

### 3.11 Schedule Integration (Design Section 11)

**File**: `src/renderer/src/features/schedule/manage-schedule/ui/ScheduleFormDialog.tsx`

| Item                                         | Design                                                             | Implementation             | Status |
| -------------------------------------------- | ------------------------------------------------------------------ | -------------------------- | ------ |
| Import ReminderPendingSelect, ReminderSelect | from `@features/reminder`                                          | Line 19: exact match       | MATCH  |
| Import useSetReminder                        | from `@entities/reminder`                                          | Line 20: exact match       | MATCH  |
| pendingReminders state                       | `useState<number[]>([])`                                           | Line 66: exact match       | MATCH  |
| handleOpenChange reset                       | `setPendingReminders([])`                                          | Line 133: exact match      | MATCH  |
| Create mode: ReminderPendingSelect           | rendered when `!isEdit`                                            | Lines 417-422: exact match | MATCH  |
| Edit mode: ReminderSelect                    | rendered when `isEdit` with `initialData.id`                       | Lines 412-416: exact match | MATCH  |
| onSuccess (create): reminder calls           | `pendingReminders.forEach(offsetMs => setReminderMut.mutate(...))` | Lines 206-213: exact match | MATCH  |
| onSuccess (create): reset                    | `setPendingReminders([])`                                          | Line 217: exact match      | MATCH  |

**File**: `src/renderer/src/features/schedule/manage-schedule/ui/ScheduleDetailPopover.tsx`

| Item                                  | Design                                                      | Implementation                                          | Status |
| ------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- | ------ |
| Import useReminders, REMINDER_OFFSETS | from `@entities/reminder`                                   | Line 15: exact match                                    | MATCH  |
| Import Bell icon                      | from `lucide-react`                                         | Line 4: exact match                                     | MATCH  |
| useReminders call                     | `useReminders('schedule', schedule.id)`                     | Line 37: exact match                                    | MATCH  |
| isTodo guard                          | `!isTodo && reminders.length > 0`                           | Line 118: `!isTodo && reminders.length > 0` exact match | MATCH  |
| Read-only display                     | Bell icon + comma-joined labels                             | Lines 119-130: exact match                              | MATCH  |
| Label lookup                          | `REMINDER_OFFSETS.find(o => o.value === r.offsetMs)?.label` | Line 124: exact match                                   | MATCH  |
| Fallback label                        | `Math.round(r.offsetMs / 60000) + '분 전'`                  | Line 125: exact match                                   | MATCH  |

**Section 11 Result**: 15/15 items MATCH

---

### 3.12 Backend Service Integration (Design Section 12)

**File**: `src/main/services/todo.ts`

| Item                          | Design                                                                                         | Implementation             | Status |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------- | ------ |
| Import reminderService        | `from './reminder'`                                                                            | Line 6: exact match        | MATCH  |
| update - isDone === true      | `reminderService.removeUnfiredByEntity('todo', todoId)`                                        | Lines 185-187: exact match | MATCH  |
| update - date change guard    | `doneFields.isDone !== true && (data.dueDate !== undefined \|\| data.startDate !== undefined)` | Line 190: exact match      | MATCH  |
| update - date removed all     | `reminderService.removeByEntity('todo', todoId)`                                               | Lines 191-193: exact match | MATCH  |
| update - date changed         | `reminderService.recalculate('todo', todoId)`                                                  | Lines 194-196: exact match | MATCH  |
| update - parent auto-complete | `reminderService.removeUnfiredByEntity('todo', todo.parentId)`                                 | Line 212: exact match      | MATCH  |
| reorderKanban - completed     | `reminderService.removeUnfiredByEntity('todo', u.id)`                                          | Lines 260-264: exact match | MATCH  |
| remove - descendants          | `reminderService.removeByEntities('todo', [todoId, ...subtodoIds])`                            | Line 224: exact match      | MATCH  |

**File**: `src/main/services/schedule.ts`

| Item                           | Design                                                   | Implementation             | Status |
| ------------------------------ | -------------------------------------------------------- | -------------------------- | ------ |
| Import reminderService         | `from './reminder'`                                      | Line 8: exact match        | MATCH  |
| update - startAt/allDay change | `reminderService.recalculate('schedule', scheduleId)`    | Lines 236-238: exact match | MATCH  |
| remove - cleanup               | `reminderService.removeByEntity('schedule', scheduleId)` | Line 246: exact match      | MATCH  |
| move - recalculate             | `reminderService.recalculate('schedule', scheduleId)`    | Line 269: exact match      | MATCH  |

**Section 12 Result**: 12/12 items MATCH

---

### 3.13 MainLayout Integration (Design Section 13)

**File**: `src/renderer/src/app/layout/MainLayout.tsx`

| Item                      | Design                      | Implementation       | Status |
| ------------------------- | --------------------------- | -------------------- | ------ |
| Import useReminderWatcher | `from '@features/reminder'` | Line 13: exact match | MATCH  |
| useReminderWatcher() call | inside MainLayout component | Line 52: exact match | MATCH  |

**Section 13 Result**: 2/2 items MATCH

---

## 4. Summary by Section

| Section                  | Design Description                                                      |  Items  | Matched |   Rate   |
| ------------------------ | ----------------------------------------------------------------------- | :-----: | :-----: | :------: |
| 1. DB Schema             | reminders table + indexes + schema/index.ts                             |   13    |   13    |   100%   |
| 2. Repository            | 11 methods with CHUNK=900                                               |   11    |   11    |   100%   |
| 3. Service               | VALID_OFFSETS, getBaseTime, set/remove/recalculate/findPendingWithTitle |   21    |   21    |   100%   |
| 4. IPC Handler           | 4 handler channels                                                      |    5    |    5    |   100%   |
| 5. Scheduler             | 1-min interval, 5-min stale, Notification                               |   12    |   12    |   100%   |
| 6. index.ts              | Handler registration + scheduler lifecycle                              |    6    |    6    |   100%   |
| 7. Preload               | runtime bridge + type definitions                                       |    9    |    9    |   100%   |
| 8. entities/reminder     | types + queries + barrel                                                |   10    |   10    |   100%   |
| 9. features/reminder     | ReminderSelect + PendingSelect + watcher + barrel                       |   20    |   20    |   100%   |
| 10. Todo Integration     | CreateTodoDialog + TodoDetailFields                                     |   15    |   15    |   100%   |
| 11. Schedule Integration | ScheduleFormDialog + ScheduleDetailPopover                              |   15    |   15    |   100%   |
| 12. Service Integration  | todo.ts 3 paths + schedule.ts 3 paths                                   |   12    |   12    |   100%   |
| 13. MainLayout           | useReminderWatcher registration                                         |    2    |    2    |   100%   |
| **Total**                |                                                                         | **151** | **151** | **100%** |

---

## 5. Cosmetic Differences (Non-functional)

These differences improve on the design without changing behavior.

| #   | File                                                       | Design                                 | Implementation                                                                           | Assessment                                                                               |
| --- | ---------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `src/main/repositories/reminder.ts`                        | `entityType: string`                   | `entityType: 'todo' \| 'schedule'`                                                       | Type safety improvement: stricter union type prevents invalid entityType at compile time |
| 2   | `src/main/services/reminder.ts`                            | `getBaseTime(entityType: string, ...)` | `getBaseTime(entityType: EntityType, ...)` with `type EntityType = 'todo' \| 'schedule'` | Type alias extraction for reuse across service methods                                   |
| 3   | `src/main/ipc/reminder.ts`                                 | `entityType: string`                   | `entityType: 'todo' \| 'schedule'`                                                       | Consistent with repository/service typing                                                |
| 4   | `src/renderer/src/features/reminder/ui/ReminderSelect.tsx` | `new Map(reminders.map(...))`          | `new Map<number, ReminderItem>(reminders.map(...))`                                      | Explicit generic type annotation on Map constructor                                      |

All 4 differences are type-safety improvements that do not affect runtime behavior.

---

## 6. Missing Features (Design O, Implementation X)

None.

---

## 7. Added Features (Design X, Implementation O)

None.

---

## 8. Changed Features (Design != Implementation)

None (functional).

---

## 9. Architecture Compliance

### 9.1 FSD Layer Verification

| Component                                       | Expected Layer | Actual Layer                          | Status |
| ----------------------------------------------- | -------------- | ------------------------------------- | ------ |
| entities/reminder/model/types.ts                | entities       | `src/renderer/src/entities/reminder/` | PASS   |
| entities/reminder/model/queries.ts              | entities       | `src/renderer/src/entities/reminder/` | PASS   |
| features/reminder/ui/ReminderSelect.tsx         | features       | `src/renderer/src/features/reminder/` | PASS   |
| features/reminder/ui/ReminderPendingSelect.tsx  | features       | `src/renderer/src/features/reminder/` | PASS   |
| features/reminder/model/use-reminder-watcher.ts | features       | `src/renderer/src/features/reminder/` | PASS   |

### 9.2 Import Direction Verification

| File                                 | Imports From                                           | Direction                                   | Status |
| ------------------------------------ | ------------------------------------------------------ | ------------------------------------------- | ------ |
| ReminderSelect.tsx (features)        | @entities/reminder, @shared/ui                         | features -> entities, shared                | PASS   |
| ReminderPendingSelect.tsx (features) | @entities/reminder, @shared/ui                         | features -> entities, shared                | PASS   |
| use-reminder-watcher.ts (features)   | @features/tap-system, @shared/constants                | features -> features (same layer), shared   | PASS   |
| CreateTodoDialog.tsx (features)      | @entities/todo, @entities/reminder, @features/reminder | features -> entities, features (same layer) | PASS   |
| TodoDetailFields.tsx (widgets)       | @features/reminder                                     | widgets -> features                         | PASS   |
| ScheduleFormDialog.tsx (features)    | @entities/reminder, @features/reminder                 | features -> entities, features (same layer) | PASS   |
| ScheduleDetailPopover.tsx (features) | @entities/reminder                                     | features -> entities                        | PASS   |
| MainLayout.tsx (app)                 | @features/reminder                                     | app -> features                             | PASS   |

All import directions comply with FSD rules.

### 9.3 Main Process Layer Verification

| File                           | Layer      | Imports                       | Status |
| ------------------------------ | ---------- | ----------------------------- | ------ |
| repositories/reminder.ts       | Repository | db, schema                    | PASS   |
| services/reminder.ts           | Service    | repositories, lib/errors      | PASS   |
| services/reminder-scheduler.ts | Service    | services/reminder, electron   | PASS   |
| ipc/reminder.ts                | IPC        | services/reminder, lib/handle | PASS   |
| services/todo.ts               | Service    | services/reminder (peer)      | PASS   |
| services/schedule.ts           | Service    | services/reminder (peer)      | PASS   |

---

## 10. Convention Compliance

### 10.1 Naming Convention

| Category        | Convention       | Files Checked | Compliance | Violations |
| --------------- | ---------------- | :-----------: | :--------: | ---------- |
| Components      | PascalCase       |       4       |    100%    | -          |
| Functions       | camelCase        |      18       |    100%    | -          |
| Constants       | UPPER_SNAKE_CASE |       4       |    100%    | -          |
| Component files | PascalCase.tsx   |       4       |    100%    | -          |
| Utility files   | kebab-case.ts    |       5       |    100%    | -          |
| Folders         | kebab-case       |       4       |    100%    | -          |

### 10.2 Import Order

All files follow: external libraries -> internal absolute (@/) -> relative (./) -> type imports.

No violations found.

---

## 11. Design Checklist Verification

Mapping each checklist item from design Section 14.

| #   | Checklist Item                                                                         | Status                       |
| --- | -------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | `src/main/db/schema/reminder.ts` created (indexes included)                            | DONE                         |
| 2   | `src/main/db/schema/index.ts` export added                                             | DONE                         |
| 3   | `npm run db:generate && npm run db:migrate`                                            | DONE (migration files exist) |
| 4   | `src/main/repositories/reminder.ts` created                                            | DONE                         |
| 5   | `src/main/services/reminder.ts` created (offset validation + past-time rejection)      | DONE                         |
| 6   | `src/main/ipc/reminder.ts` created                                                     | DONE                         |
| 7   | `src/main/index.ts` handler registration + scheduler start/stop                        | DONE                         |
| 8   | `src/main/services/reminder-scheduler.ts` created (5-min stale skip)                   | DONE                         |
| 9   | `src/preload/index.ts` reminder namespace added                                        | DONE                         |
| 10  | `src/preload/index.d.ts` types added                                                   | DONE                         |
| 11  | `src/renderer/src/entities/reminder/` created (types + queries)                        | DONE                         |
| 12  | `src/renderer/src/features/reminder/` created (3 components)                           | DONE                         |
| 13  | `MainLayout.tsx` watcher added (from `@features/reminder`)                             | DONE                         |
| 14  | `CreateTodoDialog.tsx` reminder selection (date removal resets pendingReminders)       | DONE                         |
| 15  | `TodoDetailFields.tsx` reminder display/edit added                                     | DONE                         |
| 16  | `ScheduleFormDialog.tsx` reminder selection added                                      | DONE                         |
| 17  | `ScheduleDetailPopover.tsx` reminder display added                                     | DONE                         |
| 18  | `src/main/services/todo.ts` integration (time change/complete/delete)                  | DONE                         |
| 19  | `src/main/services/schedule.ts` integration (time change/move/delete including move()) | DONE                         |

**Checklist**: 19/19 items DONE

---

## 12. Recommended Actions

None required. All design items are fully implemented with no functional gaps.

---

## 13. Final Assessment

```
Match Rate: 100% (151/151 design items)
Cosmetic Diffs: 4 (all type-safety improvements)
Missing Features: 0
Added Features: 0
Changed Features: 0
Architecture Violations: 0
Convention Violations: 0
```

The reminder feature implementation perfectly matches the design document. The 4 cosmetic differences are all type-safety improvements (narrowing `string` to `'todo' | 'schedule'` union type) that strengthen correctness without any behavioral change.

---

## Version History

| Version | Date       | Changes              | Author       |
| ------- | ---------- | -------------------- | ------------ |
| 1.0     | 2026-03-03 | Initial gap analysis | gap-detector |
