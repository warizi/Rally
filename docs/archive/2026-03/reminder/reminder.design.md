# Design: 알림(Reminder) 기능

> Plan 참조: `docs/01-plan/features/reminder.plan.md`

---

## 0. 구현 우선순위

```
[0단계] DB 스키마 + 마이그레이션
  src/main/db/schema/reminder.ts 신규
  src/main/db/schema/index.ts reminders export 추가
  npm run db:generate && npm run db:migrate

[1단계] Main Process — Repository + Service
  repositories/reminder.ts → services/reminder.ts

[2단계] Main Process — IPC + Preload
  ipc/reminder.ts → index.ts 핸들러 등록
  preload/index.ts reminder 네임스페이스 추가
  preload/index.d.ts ReminderAPI 타입 추가

[3단계] Main Process — 스케줄러 + Notification
  services/reminder-scheduler.ts 신규
  index.ts 스케줄러 시작/정리

[4단계] Renderer — entities/reminder (React Query)
  types.ts → queries.ts → index.ts

[5단계] Renderer — features/reminder UI
  ReminderSelect + ReminderPendingSelect + useReminderWatcher

[6단계] Todo 통합
  CreateTodoDialog + TodoDetailFields에 ReminderSelect 추가

[7단계] Schedule 통합
  ScheduleFormDialog + ScheduleDetailPopover에 알림 UI 추가

[8단계] 연동 — 시간 변경/완료/삭제 시 알림 처리
  todo.ts + schedule.ts 서비스 수정
```

---

## 1. DB Schema

### `src/main/db/schema/reminder.ts`

```typescript
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'

export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type', { enum: ['todo', 'schedule'] }).notNull(),
    entityId: text('entity_id').notNull(),
    offsetMs: integer('offset_ms').notNull(),
    remindAt: integer('remind_at', { mode: 'timestamp_ms' }).notNull(),
    isFired: integer('is_fired', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => [
    index('idx_reminders_entity').on(table.entityType, table.entityId),
    index('idx_reminders_pending').on(table.isFired, table.remindAt)
  ]
)
```

> `entityId`는 다형 참조(polymorphic). todo.id 또는 schedule.id를 가리키며 FK 제약 없음.
> 인덱스: `idx_reminders_entity` — Entity 조회/삭제용, `idx_reminders_pending` — 스케줄러 findPending용.

### `src/main/db/schema/index.ts` 변경

```typescript
import { reminders } from './reminder'
// ... 기존 import

export {
  // ... 기존 export
  reminders
}
```

---

## 2. Repository

### `src/main/repositories/reminder.ts`

```typescript
import { and, eq, lte, inArray } from 'drizzle-orm'
import { db } from '../db'
import { reminders } from '../db/schema'

export type Reminder = typeof reminders.$inferSelect
export type ReminderInsert = typeof reminders.$inferInsert

export const reminderRepository = {
  findByEntity(entityType: string, entityId: string): Reminder[] {
    return db
      .select()
      .from(reminders)
      .where(and(eq(reminders.entityType, entityType), eq(reminders.entityId, entityId)))
      .all()
  },

  findPending(now: Date): Reminder[] {
    return db
      .select()
      .from(reminders)
      .where(and(lte(reminders.remindAt, now), eq(reminders.isFired, false)))
      .all()
  },

  findById(id: string): Reminder | undefined {
    return db.select().from(reminders).where(eq(reminders.id, id)).get()
  },

  create(data: ReminderInsert): Reminder {
    return db.insert(reminders).values(data).returning().get()
  },

  update(
    id: string,
    data: Partial<Pick<Reminder, 'remindAt' | 'isFired' | 'updatedAt'>>
  ): Reminder | undefined {
    return db.update(reminders).set(data).where(eq(reminders.id, id)).returning().get()
  },

  markFired(id: string, now: Date): void {
    db.update(reminders)
      .set({ isFired: true, updatedAt: now })
      .where(eq(reminders.id, id))
      .run()
  },

  delete(id: string): void {
    db.delete(reminders).where(eq(reminders.id, id)).run()
  },

  deleteByEntity(entityType: string, entityId: string): void {
    db.delete(reminders)
      .where(and(eq(reminders.entityType, entityType), eq(reminders.entityId, entityId)))
      .run()
  },

  deleteByEntities(entityType: string, entityIds: string[]): void {
    if (entityIds.length === 0) return
    const CHUNK = 900
    for (let i = 0; i < entityIds.length; i += CHUNK) {
      const chunk = entityIds.slice(i, i + CHUNK)
      db.delete(reminders)
        .where(and(eq(reminders.entityType, entityType), inArray(reminders.entityId, chunk)))
        .run()
    }
  },

  deleteUnfiredByEntity(entityType: string, entityId: string): void {
    db.delete(reminders)
      .where(
        and(
          eq(reminders.entityType, entityType),
          eq(reminders.entityId, entityId),
          eq(reminders.isFired, false)
        )
      )
      .run()
  }
}
```

---

## 3. Service

### `src/main/services/reminder.ts`

```typescript
import { nanoid } from 'nanoid'
import { NotFoundError, ValidationError } from '../lib/errors'
import { reminderRepository } from '../repositories/reminder'
import { todoRepository } from '../repositories/todo'
import { scheduleRepository } from '../repositories/schedule'
import type { Reminder } from '../repositories/reminder'

// === 허용 오프셋 값 (유효성 검증용) ===

const VALID_OFFSETS = new Set([
  10 * 60 * 1000,       // 10분
  30 * 60 * 1000,       // 30분
  60 * 60 * 1000,       // 1시간
  24 * 60 * 60 * 1000,  // 1일
  2 * 24 * 60 * 60 * 1000 // 2일
])

// === Domain Types ===

export interface ReminderItem {
  id: string
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
  remindAt: Date
  isFired: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SetReminderData {
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
}

// === Mapper ===

function toReminderItem(row: Reminder): ReminderItem {
  return {
    id: row.id,
    entityType: row.entityType as ReminderItem['entityType'],
    entityId: row.entityId,
    offsetMs: row.offsetMs,
    remindAt: row.remindAt instanceof Date ? row.remindAt : new Date(row.remindAt as number),
    isFired: row.isFired,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as number),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as number)
  }
}

// === remind_at 계산 ===

function getBaseTime(entityType: string, entityId: string): Date | null {
  if (entityType === 'todo') {
    const todo = todoRepository.findById(entityId)
    if (!todo) return null
    // dueDate 우선, 없으면 startDate
    const raw = todo.dueDate ?? todo.startDate
    if (!raw) return null
    return raw instanceof Date ? raw : new Date(raw as number)
  }

  if (entityType === 'schedule') {
    const schedule = scheduleRepository.findById(entityId)
    if (!schedule) return null
    const startAt =
      schedule.startAt instanceof Date ? schedule.startAt : new Date(schedule.startAt as number)
    // allDay: 00:00 → 09:00 보정
    if (schedule.allDay) {
      const adjusted = new Date(startAt)
      adjusted.setHours(9, 0, 0, 0)
      return adjusted
    }
    return startAt
  }

  return null
}

function calcRemindAt(baseTime: Date, offsetMs: number): Date {
  return new Date(baseTime.getTime() - offsetMs)
}

// === Service ===

export const reminderService = {
  findByEntity(entityType: string, entityId: string): ReminderItem[] {
    return reminderRepository.findByEntity(entityType, entityId).map(toReminderItem)
  },

  set(data: SetReminderData): ReminderItem {
    // 유효한 offset 값 검증
    if (!VALID_OFFSETS.has(data.offsetMs)) {
      throw new ValidationError('유효하지 않은 알림 오프셋입니다')
    }

    const baseTime = getBaseTime(data.entityType, data.entityId)
    if (!baseTime) {
      throw new NotFoundError('알림 기준 시각을 찾을 수 없습니다')
    }

    const now = new Date()
    const remindAt = calcRemindAt(baseTime, data.offsetMs)

    // 과거 시각이면 알림 생성 건너뜀 (이미 지난 알림은 의미 없음)
    if (remindAt.getTime() <= now.getTime()) {
      throw new ValidationError('알림 시각이 이미 지났습니다')
    }

    // 동일 entity + 동일 offset 중복 방지
    const existing = reminderRepository.findByEntity(data.entityType, data.entityId)
    const duplicate = existing.find((r) => r.offsetMs === data.offsetMs)
    if (duplicate) {
      // 이미 존재하면 remind_at 재계산만
      const updated = reminderRepository.update(duplicate.id, {
        remindAt,
        isFired: false,
        updatedAt: now
      })
      return toReminderItem(updated!)
    }

    const row = reminderRepository.create({
      id: nanoid(),
      entityType: data.entityType,
      entityId: data.entityId,
      offsetMs: data.offsetMs,
      remindAt,
      isFired: false,
      createdAt: now,
      updatedAt: now
    })

    return toReminderItem(row)
  },

  remove(reminderId: string): void {
    const reminder = reminderRepository.findById(reminderId)
    if (!reminder) throw new NotFoundError('알림을 찾을 수 없습니다')
    reminderRepository.delete(reminderId)
  },

  removeByEntity(entityType: string, entityId: string): void {
    reminderRepository.deleteByEntity(entityType, entityId)
  },

  removeByEntities(entityType: string, entityIds: string[]): void {
    reminderRepository.deleteByEntities(entityType, entityIds)
  },

  /** 미발송 알림만 삭제 (완료 시 사용) */
  removeUnfiredByEntity(entityType: string, entityId: string): void {
    reminderRepository.deleteUnfiredByEntity(entityType, entityId)
  },

  /** entity 시간 변경 시 모든 알림의 remind_at 재계산 */
  recalculate(entityType: string, entityId: string): void {
    const baseTime = getBaseTime(entityType, entityId)
    if (!baseTime) {
      // 기준 시각 없음 → 모든 알림 삭제
      reminderRepository.deleteByEntity(entityType, entityId)
      return
    }

    const existing = reminderRepository.findByEntity(entityType, entityId)
    const now = new Date()
    for (const r of existing) {
      const newRemindAt = calcRemindAt(baseTime, r.offsetMs)
      reminderRepository.update(r.id, {
        remindAt: newRemindAt,
        isFired: false,
        updatedAt: now
      })
    }
  },

  /** 스케줄러용: 발송 대상 조회 + entity 제목 포함 */
  findPendingWithTitle(now: Date): Array<ReminderItem & { title: string }> {
    const pending = reminderRepository.findPending(now)
    const results: Array<ReminderItem & { title: string }> = []

    for (const r of pending) {
      let title = ''
      if (r.entityType === 'todo') {
        const todo = todoRepository.findById(r.entityId)
        title = todo?.title ?? '(삭제된 할 일)'
      } else if (r.entityType === 'schedule') {
        const schedule = scheduleRepository.findById(r.entityId)
        title = schedule?.title ?? '(삭제된 일정)'
      }
      results.push({ ...toReminderItem(r), title })
    }

    return results
  },

  markFired(reminderId: string): void {
    reminderRepository.markFired(reminderId, new Date())
  }
}
```

---

## 4. IPC Handler

### `src/main/ipc/reminder.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'
import { reminderService } from '../services/reminder'
import type { SetReminderData } from '../services/reminder'

export function registerReminderHandlers(): void {
  ipcMain.handle(
    'reminder:findByEntity',
    (_: IpcMainInvokeEvent, entityType: string, entityId: string): IpcResponse =>
      handle(() => reminderService.findByEntity(entityType, entityId))
  )

  ipcMain.handle(
    'reminder:set',
    (_: IpcMainInvokeEvent, data: SetReminderData): IpcResponse =>
      handle(() => reminderService.set(data))
  )

  ipcMain.handle(
    'reminder:remove',
    (_: IpcMainInvokeEvent, reminderId: string): IpcResponse =>
      handle(() => reminderService.remove(reminderId))
  )

  ipcMain.handle(
    'reminder:removeByEntity',
    (_: IpcMainInvokeEvent, entityType: string, entityId: string): IpcResponse =>
      handle(() => reminderService.removeByEntity(entityType, entityId))
  )
}
```

---

## 5. 알림 스케줄러

### `src/main/services/reminder-scheduler.ts`

```typescript
import { Notification, BrowserWindow } from 'electron'
import { reminderService } from './reminder'

const CHECK_INTERVAL = 60_000 // 1분
const STALE_THRESHOLD = 5 * 60_000 // 5분: 이보다 오래된 미발송 알림은 무시

let intervalId: ReturnType<typeof setInterval> | null = null

function checkAndFire(): void {
  const now = new Date()
  const pending = reminderService.findPendingWithTitle(now)

  for (const item of pending) {
    // 과거 알림 필터: remind_at이 5분 이상 지난 알림은 발송하지 않고 fired 처리만
    if (now.getTime() - item.remindAt.getTime() > STALE_THRESHOLD) {
      reminderService.markFired(item.id)
      continue
    }

    // Notification 발송
    const notification = new Notification({
      title: item.entityType === 'todo' ? '할 일 알림' : '일정 알림',
      body: item.title
    })

    notification.on('click', () => {
      // 모든 윈도우에 알림 클릭 이벤트 전송
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send('reminder:fired', {
          entityType: item.entityType,
          entityId: item.entityId,
          title: item.title
        })
      })
      // 첫 번째 윈도우 포커스
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
      }
    })

    notification.show()

    // 발송 완료 마킹
    reminderService.markFired(item.id)
  }
}

export const reminderScheduler = {
  start(): void {
    if (intervalId) return
    // 앱 시작 시 즉시 1회 체크
    checkAndFire()
    intervalId = setInterval(checkAndFire, CHECK_INTERVAL)
  },

  stop(): void {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}
```

---

## 6. `src/main/index.ts` 변경

```typescript
// 추가 import
import { registerReminderHandlers } from './ipc/reminder'
import { reminderScheduler } from './services/reminder-scheduler'

// app.whenReady().then 내부에 추가:
  registerReminderHandlers()

// createWindow() 후에 추가:
  reminderScheduler.start()

// before-quit 핸들러 수정:
app.on('before-quit', (event) => {
  if (isQuitting) return
  event.preventDefault()
  isQuitting = true
  reminderScheduler.stop()  // 추가
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1000))
  session.defaultSession.flushStorageData()
  Promise.race([workspaceWatcher.stop(), timeout]).finally(() => app.quit())
})
```

---

## 7. Preload Bridge

### `src/preload/index.ts` 추가

```typescript
  reminder: {
    findByEntity: (entityType: string, entityId: string) =>
      ipcRenderer.invoke('reminder:findByEntity', entityType, entityId),
    set: (data: unknown) => ipcRenderer.invoke('reminder:set', data),
    remove: (reminderId: string) => ipcRenderer.invoke('reminder:remove', reminderId),
    removeByEntity: (entityType: string, entityId: string) =>
      ipcRenderer.invoke('reminder:removeByEntity', entityType, entityId),
    onFired: (
      callback: (data: { entityType: string; entityId: string; title: string }) => void
    ) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        data: { entityType: string; entityId: string; title: string }
      ): void => callback(data)
      ipcRenderer.on('reminder:fired', handler)
      return () => ipcRenderer.removeListener('reminder:fired', handler)
    }
  }
```

### `src/preload/index.d.ts` 추가

```typescript
interface ReminderItem {
  id: string
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
  remindAt: Date
  isFired: boolean
  createdAt: Date
  updatedAt: Date
}

interface SetReminderData {
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
}

interface ReminderAPI {
  findByEntity: (
    entityType: 'todo' | 'schedule',
    entityId: string
  ) => Promise<IpcResponse<ReminderItem[]>>
  set: (data: SetReminderData) => Promise<IpcResponse<ReminderItem>>
  remove: (reminderId: string) => Promise<IpcResponse<void>>
  removeByEntity: (
    entityType: 'todo' | 'schedule',
    entityId: string
  ) => Promise<IpcResponse<void>>
  onFired: (
    callback: (data: { entityType: string; entityId: string; title: string }) => void
  ) => () => void
}

// API interface에 추가:
interface API {
  // ... 기존 필드
  reminder: ReminderAPI
}
```

---

## 8. Renderer — entities/reminder

### `src/renderer/src/entities/reminder/model/types.ts`

```typescript
export interface ReminderItem {
  id: string
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
  remindAt: Date
  isFired: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SetReminderData {
  entityType: 'todo' | 'schedule'
  entityId: string
  offsetMs: number
}

export const REMINDER_OFFSETS = [
  { label: '10분 전', value: 10 * 60 * 1000 },
  { label: '30분 전', value: 30 * 60 * 1000 },
  { label: '1시간 전', value: 60 * 60 * 1000 },
  { label: '1일 전', value: 24 * 60 * 60 * 1000 },
  { label: '2일 전', value: 2 * 24 * 60 * 60 * 1000 }
] as const
```

### `src/renderer/src/entities/reminder/model/queries.ts`

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
import type { ReminderItem, SetReminderData } from './types'

const REMINDER_KEY = 'reminder'

export function useReminders(
  entityType: 'todo' | 'schedule' | null,
  entityId: string | null | undefined
): UseQueryResult<ReminderItem[]> {
  return useQuery({
    queryKey: [REMINDER_KEY, entityType, entityId],
    queryFn: async (): Promise<ReminderItem[]> => {
      const res: IpcResponse<ReminderItem[]> = await window.api.reminder.findByEntity(
        entityType!,
        entityId!
      )
      if (!res.success) throwIpcError(res)
      return res.data ?? []
    },
    enabled: !!entityType && !!entityId
  })
}

export function useSetReminder(): UseMutationResult<
  ReminderItem | undefined,
  Error,
  SetReminderData
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: SetReminderData) => {
      const res: IpcResponse<ReminderItem> = await window.api.reminder.set(data)
      if (!res.success) throwIpcError(res)
      return res.data
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({
        queryKey: [REMINDER_KEY, data.entityType, data.entityId]
      })
    }
  })
}

export function useRemoveReminder(): UseMutationResult<
  void,
  Error,
  { reminderId: string; entityType: string; entityId: string }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ reminderId }) => {
      const res: IpcResponse<void> = await window.api.reminder.remove(reminderId)
      if (!res.success) throwIpcError(res)
    },
    onSuccess: (_, { entityType, entityId }) => {
      queryClient.invalidateQueries({
        queryKey: [REMINDER_KEY, entityType, entityId]
      })
    }
  })
}
```

### `src/renderer/src/entities/reminder/index.ts`

```typescript
export type { ReminderItem, SetReminderData } from './model/types'
export { REMINDER_OFFSETS } from './model/types'
export { useReminders, useSetReminder, useRemoveReminder } from './model/queries'
```

> **주의**: `useReminderWatcher`는 `openTab` (features 레이어)을 사용하므로 FSD 규칙상 entities에 배치 불가. → §9 features/reminder로 이동.

---

## 9. Renderer — features/reminder UI

### `src/renderer/src/features/reminder/ui/ReminderSelect.tsx`

```typescript
import { Bell } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Checkbox } from '@shared/ui/checkbox'
import { useReminders, useSetReminder, useRemoveReminder, REMINDER_OFFSETS } from '@entities/reminder'
import type { ReminderItem } from '@entities/reminder'

interface Props {
  entityType: 'todo' | 'schedule'
  entityId: string
  disabled?: boolean
}

export function ReminderSelect({ entityType, entityId, disabled }: Props): React.JSX.Element {
  const { data: reminders = [] } = useReminders(entityType, entityId)
  const setReminder = useSetReminder()
  const removeReminder = useRemoveReminder()

  // offset별 상태: unfired(활성) / fired(발송됨) / 없음
  const reminderByOffset = new Map(reminders.map((r) => [r.offsetMs, r]))

  const activeCount = reminders.filter((r) => !r.isFired).length

  function handleToggle(offsetMs: number, checked: boolean): void {
    if (checked) {
      setReminder.mutate({ entityType, entityId, offsetMs })
    } else {
      const target = reminderByOffset.get(offsetMs)
      if (target) {
        removeReminder.mutate({ reminderId: target.id, entityType, entityId })
      }
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1.5"
        >
          <Bell className="size-3.5" />
          {activeCount > 0 ? `${activeCount}개` : '알림'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="space-y-1.5">
          {REMINDER_OFFSETS.map((opt) => {
            const reminder = reminderByOffset.get(opt.value)
            const isFired = reminder?.isFired === true

            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 cursor-pointer text-sm ${isFired ? 'text-muted-foreground line-through' : ''}`}
              >
                <Checkbox
                  checked={!!reminder}
                  onCheckedChange={(checked) => handleToggle(opt.value, !!checked)}
                />
                {opt.label}
                {isFired && <span className="text-xs text-muted-foreground ml-auto">발송됨</span>}
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### 생성 시 전용 (entityId 없을 때)

### `src/renderer/src/features/reminder/ui/ReminderPendingSelect.tsx`

```typescript
import { Bell } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Checkbox } from '@shared/ui/checkbox'
import { REMINDER_OFFSETS } from '@entities/reminder'

interface Props {
  selected: number[]
  onChange: (selected: number[]) => void
  disabled?: boolean
}

/** 생성 다이얼로그용: entity가 아직 없으므로 로컬 state로 관리 */
export function ReminderPendingSelect({ selected, onChange, disabled }: Props): React.JSX.Element {
  const activeSet = new Set(selected)

  function handleToggle(value: number, checked: boolean): void {
    if (checked) {
      onChange([...selected, value])
    } else {
      onChange(selected.filter((v) => v !== value))
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5">
          <Bell className="size-3.5" />
          {selected.length > 0 ? `${selected.length}개` : '알림'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2">
        <div className="space-y-1.5">
          {REMINDER_OFFSETS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={activeSet.has(opt.value)}
                onCheckedChange={(checked) => handleToggle(opt.value, !!checked)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### `src/renderer/src/features/reminder/model/use-reminder-watcher.ts`

```typescript
import { useEffect } from 'react'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import type { TabType } from '@shared/constants/tab-url'

/** MainLayout에서 호출 — reminder:fired push 이벤트 구독 + 탭 열기 */
export function useReminderWatcher(): void {
  const openTab = useTabStore((s) => s.openTab)

  useEffect(() => {
    const unsub = window.api.reminder.onFired(
      (data: { entityType: string; entityId: string; title: string }) => {
        const map: Record<string, { type: TabType; pathname: string } | null> = {
          todo: { type: 'todo-detail', pathname: `/todo/${data.entityId}` },
          schedule: null // schedule은 별도 탭이 없으므로 캘린더 탭 열기
        }

        const opts = map[data.entityType]
        if (opts) {
          openTab({ ...opts, title: data.title })
        } else if (data.entityType === 'schedule') {
          openTab({ type: 'calendar', pathname: '/calendar', title: '캘린더' })
        }
      }
    )
    return unsub
  }, [openTab])
}
```

> FSD 계층 준수: features 레이어에서 같은 features 레이어(`tap-system`)를 import하므로 위반 없음.

### `src/renderer/src/features/reminder/index.ts`

```typescript
export { ReminderSelect } from './ui/ReminderSelect'
export { ReminderPendingSelect } from './ui/ReminderPendingSelect'
export { useReminderWatcher } from './model/use-reminder-watcher'
```

---

## 10. Todo 통합

### `CreateTodoDialog.tsx` 변경 요약

- `const [pendingReminders, setPendingReminders] = useState<number[]>([])` 추가
- `handleOpenChange`에서 `setPendingReminders([])` 리셋
- `dueDate`/`startDate` 변경 핸들러에서: 두 날짜가 모두 null이 되면 `setPendingReminders([])` 리셋 (날짜 제거 시 잔여 알림 선택 방지)
- JSX: `!titleOnly && (dueDate || startDate)` 조건에서 `<ReminderPendingSelect>` 렌더링
- `onSuccess`에서 `pendingReminders.forEach(offsetMs => setReminder.mutate({ ... }))` 호출

### `TodoDetailFields.tsx` 변경 요약

- `<ReminderSelect entityType="todo" entityId={todo.id} disabled={!todo.dueDate && !todo.startDate} />` 추가
- 알림 Label 행을 시작일/마감일 아래에 배치

---

## 11. Schedule 통합

### `ScheduleFormDialog.tsx` 변경 요약

- 생성 모드: `ReminderPendingSelect` 사용 + `onSuccess`에서 알림 설정
- 수정 모드: `ReminderSelect` 사용 (`initialData.id`가 있으므로 직접 API 호출)
- 우선순위/색상 행 아래에 배치

### `ScheduleDetailPopover.tsx` 변경 요약

- `isTodoItem(schedule)` 가 `false`인 경우에만 알림 표시
- 알림 데이터 조회: `useReminders('schedule', schedule.id)`
- 읽기 전용 표시: 아이콘 + "10분 전, 1시간 전" 텍스트

---

## 12. 기존 서비스 연동

### `src/main/services/todo.ts` 변경

```typescript
import { reminderService } from './reminder'

// update() 내부 — doneFields 처리 후:
if (doneFields.isDone === true) {
  reminderService.removeUnfiredByEntity('todo', todoId)
}

// update() 내부 — dueDate/startDate 변경 시 (완료 처리가 아닌 경우에만):
if (doneFields.isDone !== true && (data.dueDate !== undefined || data.startDate !== undefined)) {
  const updatedTodo = todoRepository.findById(todoId)
  if (updatedTodo && !updatedTodo.dueDate && !updatedTodo.startDate) {
    // 날짜 모두 제거 → 알림 삭제
    reminderService.removeByEntity('todo', todoId)
  } else {
    // 날짜 변경 → remind_at 재계산
    reminderService.recalculate('todo', todoId)
  }
}

// update() 내부 — 부모 자동완료 블록:
if (allDone) {
  // ... 기존 부모 업데이트 로직 ...
  reminderService.removeUnfiredByEntity('todo', todo.parentId)  // 추가
}

// reorderKanban() 내부 — bulkUpdateKanbanOrder() 호출 후:
// (DB 트랜잭션 성공 후에 알림 삭제해야 실패 시 잔여 삭제 방지)
for (const u of updates) {
  if (u.status === '완료') {
    reminderService.removeUnfiredByEntity('todo', u.id)
  }
}

// remove() 내부:
const subtodoIds = todoRepository.findAllDescendantIds(todoId)
reminderService.removeByEntities('todo', [todoId, ...subtodoIds])  // 추가
```

### `src/main/services/schedule.ts` 변경

```typescript
import { reminderService } from './reminder'

// update() 내부 — startAt 또는 allDay 변경 시:
if (data.startAt !== undefined || data.allDay !== undefined) {
  reminderService.recalculate('schedule', scheduleId)
}

// move() 내부 — 캘린더 드래그로 시간 변경 시:
// (move()는 update()를 거치지 않고 startAt/endAt을 직접 변경하므로 별도 처리)
reminderService.recalculate('schedule', scheduleId)  // 추가

// remove() 내부:
reminderService.removeByEntity('schedule', scheduleId)  // 추가
```

---

## 13. MainLayout 변경

### `src/renderer/src/app/layout/MainLayout.tsx`

```typescript
import { useReminderWatcher } from '@features/reminder'

// 컴포넌트 내부에 추가:
useReminderWatcher()
```

---

## 14. 구현 체크리스트

- [ ] `src/main/db/schema/reminder.ts` 생성 (인덱스 포함)
- [ ] `src/main/db/schema/index.ts` export 추가
- [ ] `npm run db:generate && npm run db:migrate`
- [ ] `src/main/repositories/reminder.ts` 생성
- [ ] `src/main/services/reminder.ts` 생성 (offset 검증 + 과거 시각 방지)
- [ ] `src/main/ipc/reminder.ts` 생성
- [ ] `src/main/index.ts` 핸들러 등록 + 스케줄러 시작/정리
- [ ] `src/main/services/reminder-scheduler.ts` 생성 (5분 초과 과거 알림 skip)
- [ ] `src/preload/index.ts` reminder 네임스페이스 추가
- [ ] `src/preload/index.d.ts` 타입 추가
- [ ] `src/renderer/src/entities/reminder/` 생성 (types + queries)
- [ ] `src/renderer/src/features/reminder/` 생성 (ReminderSelect + ReminderPendingSelect + useReminderWatcher)
- [ ] `src/renderer/src/app/layout/MainLayout.tsx` watcher 추가 (`@features/reminder`에서 import)
- [ ] `CreateTodoDialog.tsx` 알림 선택 추가 (날짜 제거 시 pendingReminders 리셋)
- [ ] `TodoDetailFields.tsx` 알림 표시/수정 추가
- [ ] `ScheduleFormDialog.tsx` 알림 선택 추가
- [ ] `ScheduleDetailPopover.tsx` 알림 표시 추가
- [ ] `src/main/services/todo.ts` 연동 (시간변경/완료/삭제)
- [ ] `src/main/services/schedule.ts` 연동 (시간변경/이동/삭제 — move() 포함)
