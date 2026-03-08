# Design: Reminder 테스트 코드 작성

> 작성일: 2026-03-03
> 기능: reminder-test
> Plan 참조: `docs/01-plan/features/reminder-test.plan.md`

---

## 1. 구현 순서

| 순서 | 파일                                               | 설명                                                   |
| ---- | -------------------------------------------------- | ------------------------------------------------------ |
| 1    | `src/main/repositories/__tests__/reminder.test.ts` | reminderRepository 10개 메서드 통합 테스트 (22 cases)  |
| 2    | `src/main/services/__tests__/reminder.test.ts`     | reminderService 9개 메서드 단위 테스트 (23 cases)      |
| 3    | `src/main/services/__tests__/todo.test.ts`         | todo.ts reminder 연동 (기존 파일에 mock+10 cases 추가) |
| 4    | `src/main/services/__tests__/schedule.test.ts`     | schedule.ts reminder 연동 (신규 파일, 6 cases)         |

환경 설정 변경 없음.

---

## 2. 파일 상세 설계

---

### 파일 1: `src/main/repositories/__tests__/reminder.test.ts`

> 패턴 참조: `repositories/__tests__/todo.test.ts` (testDb + schema + beforeEach)

#### 2.1.1 import & setup & 픽스처

```typescript
import { describe, expect, it, beforeEach } from 'vitest'
import { testDb } from '../../__tests__/setup'
import * as schema from '../../db/schema'
import { reminderRepository } from '../reminder'

beforeEach(() => {
  testDb.delete(schema.reminders).run()
})

function makeReminder(overrides?: Partial<typeof schema.reminders.$inferInsert>) {
  return {
    id: 'rem-1',
    entityType: 'todo' as const,
    entityId: 'todo-1',
    offsetMs: 600000,
    remindAt: new Date('2026-06-01T09:00:00Z'),
    isFired: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides
  }
}
```

**핵심 설계 판단:**

- `setup.ts`가 `reminders` 테이블을 초기화하지 않으므로 자체 `beforeEach` 추가
- `reminders` 테이블은 FK 없음 → workspace/todo/schedule 행 삽입 불필요
- `remindAt`는 `timestamp_ms` 모드 → Drizzle가 Date 객체로 반환
- `isFired`는 `mode: 'boolean'` → `true`/`false`로 반환 (`0`/`1` 아님)

#### 2.1.2 테스트 케이스

---

**findByEntity** (3건)

| #   | Case                            | 핵심 assertion   |
| --- | ------------------------------- | ---------------- |
| 1   | entity에 알림 2개 존재          | 2개 배열 반환    |
| 2   | entity에 알림 없음              | 빈 배열          |
| 3   | 다른 entityType의 동일 entityId | 해당 타입만 반환 |

```typescript
describe('findByEntity', () => {
  it('entity에 알림 2개 존재 → 2개 반환', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r1' }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', offsetMs: 1800000 }))
      .run()
    const result = reminderRepository.findByEntity('todo', 'todo-1')
    expect(result).toHaveLength(2)
  })

  it('entity에 알림 없음 → 빈 배열', () => {
    const result = reminderRepository.findByEntity('todo', 'no-entity')
    expect(result).toEqual([])
  })

  it('다른 entityType의 동일 entityId → 해당 타입만 반환', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r1', entityType: 'todo' }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', entityType: 'schedule' }))
      .run()
    const result = reminderRepository.findByEntity('todo', 'todo-1')
    expect(result).toHaveLength(1)
    expect(result[0].entityType).toBe('todo')
  })
})
```

---

**findPending** (3건)

| #   | Case                           | 핵심 assertion |
| --- | ------------------------------ | -------------- |
| 1   | remindAt <= now, isFired=false | 해당 알림 반환 |
| 2   | remindAt > now                 | 미반환         |
| 3   | remindAt <= now, isFired=true  | 미반환         |

```typescript
describe('findPending', () => {
  const now = new Date('2026-06-01T10:00:00Z')

  it('remindAt <= now, isFired=false → 반환', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ remindAt: new Date('2026-06-01T09:00:00Z'), isFired: false }))
      .run()
    const result = reminderRepository.findPending(now)
    expect(result).toHaveLength(1)
  })

  it('remindAt > now → 미반환', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ remindAt: new Date('2026-06-01T11:00:00Z') }))
      .run()
    const result = reminderRepository.findPending(now)
    expect(result).toHaveLength(0)
  })

  it('remindAt <= now, isFired=true → 미반환', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ remindAt: new Date('2026-06-01T09:00:00Z'), isFired: true }))
      .run()
    const result = reminderRepository.findPending(now)
    expect(result).toHaveLength(0)
  })
})
```

---

**findById** (2건)

| #   | Case        | 핵심 assertion     |
| --- | ----------- | ------------------ |
| 1   | 존재하는 ID | Reminder 객체 반환 |
| 2   | 없는 ID     | undefined          |

```typescript
describe('findById', () => {
  it('존재하는 ID → Reminder 반환', () => {
    testDb.insert(schema.reminders).values(makeReminder()).run()
    const result = reminderRepository.findById('rem-1')
    expect(result).toBeDefined()
    expect(result!.id).toBe('rem-1')
  })

  it('없는 ID → undefined', () => {
    expect(reminderRepository.findById('no-id')).toBeUndefined()
  })
})
```

---

**create** (1건)

| #   | Case                | 핵심 assertion                       |
| --- | ------------------- | ------------------------------------ |
| 1   | 모든 필드 포함 생성 | returning()으로 반환, Date 타입 확인 |

```typescript
describe('create', () => {
  it('모든 필드 포함 생성 → returning 반환', () => {
    const data = makeReminder()
    const result = reminderRepository.create(data)
    expect(result.id).toBe('rem-1')
    expect(result.entityType).toBe('todo')
    expect(result.offsetMs).toBe(600000)
    expect(result.remindAt).toBeInstanceOf(Date)
    expect(result.isFired).toBe(false)
  })
})
```

---

**update** (2건)

| #   | Case                             | 핵심 assertion |
| --- | -------------------------------- | -------------- |
| 1   | remindAt + isFired 부분 업데이트 | 변경된 값 반환 |
| 2   | 존재하지 않는 ID                 | undefined      |

```typescript
describe('update', () => {
  it('remindAt + isFired 부분 업데이트 → 변경된 값 반환', () => {
    testDb.insert(schema.reminders).values(makeReminder()).run()
    const newTime = new Date('2026-07-01T12:00:00Z')
    const result = reminderRepository.update('rem-1', {
      remindAt: newTime,
      isFired: true,
      updatedAt: new Date()
    })
    expect(result).toBeDefined()
    expect(result!.remindAt.getTime()).toBe(newTime.getTime())
    expect(result!.isFired).toBe(true)
  })

  it('존재하지 않는 ID → undefined', () => {
    const result = reminderRepository.update('no-id', { isFired: true, updatedAt: new Date() })
    expect(result).toBeUndefined()
  })
})
```

---

**markFired** (1건)

| #   | Case                 | 핵심 assertion  |
| --- | -------------------- | --------------- |
| 1   | isFired=false → true | findById로 확인 |

```typescript
describe('markFired', () => {
  it('isFired=false → true 전환, updatedAt 갱신', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ isFired: false }))
      .run()
    const now = new Date()
    reminderRepository.markFired('rem-1', now)
    const row = reminderRepository.findById('rem-1')
    expect(row!.isFired).toBe(true)
    expect(row!.updatedAt.getTime()).toBe(now.getTime())
  })
})
```

---

**delete** (1건)

| #   | Case             | 핵심 assertion |
| --- | ---------------- | -------------- |
| 1   | 삭제 후 findById | undefined      |

```typescript
describe('delete', () => {
  it('삭제 후 findById → undefined', () => {
    testDb.insert(schema.reminders).values(makeReminder()).run()
    reminderRepository.delete('rem-1')
    expect(reminderRepository.findById('rem-1')).toBeUndefined()
  })
})
```

---

**deleteByEntity** (2건)

| #   | Case                        | 핵심 assertion       |
| --- | --------------------------- | -------------------- |
| 1   | entity 알림 3개 → 전부 삭제 | findByEntity 빈 배열 |
| 2   | 다른 entity 알림은 유지     | 다른 entity 건재     |

```typescript
describe('deleteByEntity', () => {
  it('entity 알림 3개 → 전부 삭제', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r1' }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', offsetMs: 1800000 }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r3', offsetMs: 3600000 }))
      .run()
    reminderRepository.deleteByEntity('todo', 'todo-1')
    expect(reminderRepository.findByEntity('todo', 'todo-1')).toEqual([])
  })

  it('다른 entity 알림은 유지', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r1', entityId: 'todo-1' }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', entityId: 'todo-2' }))
      .run()
    reminderRepository.deleteByEntity('todo', 'todo-1')
    expect(reminderRepository.findByEntity('todo', 'todo-2')).toHaveLength(1)
  })
})
```

---

**deleteByEntities** (2건)

| #   | Case                          | 핵심 assertion         |
| --- | ----------------------------- | ---------------------- |
| 1   | entityIds 2개 → 4개 전부 삭제 | 모두 삭제 확인         |
| 2   | 빈 배열 전달                  | 아무것도 삭제하지 않음 |

```typescript
describe('deleteByEntities', () => {
  it('entityIds 2개, 각 알림 2개 → 4개 전부 삭제', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r1', entityId: 'a' }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', entityId: 'a', offsetMs: 1800000 }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r3', entityId: 'b' }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r4', entityId: 'b', offsetMs: 1800000 }))
      .run()
    reminderRepository.deleteByEntities('todo', ['a', 'b'])
    expect(reminderRepository.findByEntity('todo', 'a')).toEqual([])
    expect(reminderRepository.findByEntity('todo', 'b')).toEqual([])
  })

  it('빈 배열 전달 → 아무것도 삭제하지 않음', () => {
    testDb.insert(schema.reminders).values(makeReminder()).run()
    reminderRepository.deleteByEntities('todo', [])
    expect(reminderRepository.findByEntity('todo', 'todo-1')).toHaveLength(1)
  })
})
```

---

**deleteUnfiredByEntity** (2건)

| #   | Case                                     | 핵심 assertion   |
| --- | ---------------------------------------- | ---------------- |
| 1   | fired 1개 + unfired 2개 → unfired만 삭제 | fired 1개만 남음 |
| 2   | 전부 fired → 삭제 없음                   | 전부 유지        |

```typescript
describe('deleteUnfiredByEntity', () => {
  it('fired 1개 + unfired 2개 → unfired만 삭제', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r1', isFired: true }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', isFired: false, offsetMs: 1800000 }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r3', isFired: false, offsetMs: 3600000 }))
      .run()
    reminderRepository.deleteUnfiredByEntity('todo', 'todo-1')
    const remaining = reminderRepository.findByEntity('todo', 'todo-1')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].isFired).toBe(true)
  })

  it('전부 fired → 삭제 없음', () => {
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r1', isFired: true }))
      .run()
    testDb
      .insert(schema.reminders)
      .values(makeReminder({ id: 'r2', isFired: true, offsetMs: 1800000 }))
      .run()
    reminderRepository.deleteUnfiredByEntity('todo', 'todo-1')
    expect(reminderRepository.findByEntity('todo', 'todo-1')).toHaveLength(2)
  })
})
```

---

### 파일 2: `src/main/services/__tests__/reminder.test.ts`

> 패턴 참조: `services/__tests__/todo.test.ts` (vi.mock + vi.clearAllMocks)

#### 2.2.1 import & mock & 픽스처

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reminderService } from '../reminder'
import { reminderRepository } from '../../repositories/reminder'
import { todoRepository } from '../../repositories/todo'
import { scheduleRepository } from '../../repositories/schedule'
import { NotFoundError, ValidationError } from '../../lib/errors'

vi.mock('../../repositories/reminder', () => ({
  reminderRepository: {
    findByEntity: vi.fn(),
    findPending: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    markFired: vi.fn(),
    delete: vi.fn(),
    deleteByEntity: vi.fn(),
    deleteByEntities: vi.fn(),
    deleteUnfiredByEntity: vi.fn()
  }
}))

vi.mock('../../repositories/todo', () => ({
  todoRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/schedule', () => ({
  scheduleRepository: { findById: vi.fn() }
}))

vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))

// ── Fixtures ──

const TEN_MIN = 10 * 60 * 1000
const THIRTY_MIN = 30 * 60 * 1000
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000) // +1일

const MOCK_TODO = {
  id: 'todo-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Test Todo',
  description: '',
  status: '할일' as const,
  priority: 'medium' as const,
  isDone: false,
  listOrder: 0,
  kanbanOrder: 0,
  subOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  doneAt: null,
  dueDate: FUTURE,
  startDate: null
}

const MOCK_SCHEDULE = {
  id: 'sch-1',
  workspaceId: 'ws-1',
  title: 'Test Schedule',
  description: null,
  location: null,
  allDay: false,
  startAt: FUTURE,
  endAt: new Date(FUTURE.getTime() + 60 * 60 * 1000),
  color: null,
  priority: 'medium' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01')
}

const MOCK_REMINDER_ROW = {
  id: 'rem-1',
  entityType: 'todo' as const,
  entityId: 'todo-1',
  offsetMs: TEN_MIN,
  remindAt: new Date(FUTURE.getTime() - TEN_MIN),
  isFired: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(todoRepository.findById).mockReturnValue(MOCK_TODO as never)
  vi.mocked(scheduleRepository.findById).mockReturnValue(MOCK_SCHEDULE as never)
  vi.mocked(reminderRepository.findByEntity).mockReturnValue([])
  vi.mocked(reminderRepository.findById).mockReturnValue(MOCK_REMINDER_ROW)
  vi.mocked(reminderRepository.create).mockReturnValue(MOCK_REMINDER_ROW)
  vi.mocked(reminderRepository.update).mockReturnValue(MOCK_REMINDER_ROW)
})
```

**핵심 설계 판단:**

- `FUTURE`는 `Date.now() + 1일`로 항상 미래 → 과거 시각 검증에서 별도 과거 Date 사용
- `MOCK_TODO.dueDate = FUTURE` → `getBaseTime`이 dueDate 반환
- `MOCK_SCHEDULE.allDay = false` → `getBaseTime`이 startAt 그대로 반환
- `findByEntity` 기본 빈 배열 → `set()` 중복 검사 기본 통과

#### 2.2.2 테스트 케이스

---

**findByEntity** (1건)

| #   | Case                                | 핵심 assertion |
| --- | ----------------------------------- | -------------- |
| 1   | repo 반환값을 ReminderItem으로 변환 | Date 변환 확인 |

```typescript
describe('findByEntity', () => {
  it('repo 반환값을 ReminderItem으로 변환 — Date 타입', () => {
    vi.mocked(reminderRepository.findByEntity).mockReturnValue([
      {
        ...MOCK_REMINDER_ROW,
        remindAt: 1717225200000 as unknown as Date,
        createdAt: 1704067200000 as unknown as Date,
        updatedAt: 1704067200000 as unknown as Date
      }
    ])
    const result = reminderService.findByEntity('todo', 'todo-1')
    expect(result).toHaveLength(1)
    expect(result[0].remindAt).toBeInstanceOf(Date)
    expect(result[0].createdAt).toBeInstanceOf(Date)
  })
})
```

---

**set** (10건)

| #   | Case                                        | 핵심 assertion                 |
| --- | ------------------------------------------- | ------------------------------ |
| 1   | 정상 생성 (유효 offset, 미래 시각)          | ReminderItem 반환, create 호출 |
| 2   | 유효하지 않은 offset (15분=900000)          | ValidationError                |
| 3   | entity 없음 (getBaseTime null)              | NotFoundError                  |
| 4   | 과거 시각 (baseTime 이미 지남)              | ValidationError                |
| 5   | 동일 entity+offset 중복 → update            | create 미호출, update 호출     |
| 6   | todo: dueDate 우선 (dueDate+startDate 존재) | dueDate 기반 remindAt          |
| 7   | schedule allDay: 09:00 보정                 | 00:00→09:00 기반               |
| 8   | todo: startDate만 존재 (dueDate null)       | startDate 기반 remindAt        |
| 9   | 중복 + isFired=true → update                | isFired=false 리셋 확인        |
| 10  | schedule non-allDay → startAt 그대로        | 보정 없이 startAt 기반         |

```typescript
describe('set', () => {
  it('정상 생성 — ReminderItem 반환, create 호출', () => {
    const result = reminderService.set({
      entityType: 'todo',
      entityId: 'todo-1',
      offsetMs: TEN_MIN
    })
    expect(result.id).toBe('rem-1')
    expect(reminderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mock-id', entityType: 'todo', offsetMs: TEN_MIN })
    )
  })

  it('유효하지 않은 offset (15분=900000) → ValidationError', () => {
    expect(() =>
      reminderService.set({
        entityType: 'todo',
        entityId: 'todo-1',
        offsetMs: 15 * 60 * 1000
      })
    ).toThrow(ValidationError)
  })

  it('entity 없음 → NotFoundError', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    expect(() =>
      reminderService.set({
        entityType: 'todo',
        entityId: 'no-todo',
        offsetMs: TEN_MIN
      })
    ).toThrow(NotFoundError)
  })

  it('과거 시각 → ValidationError', () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
    vi.mocked(todoRepository.findById).mockReturnValue({
      ...MOCK_TODO,
      dueDate: pastDate
    } as never)
    expect(() =>
      reminderService.set({
        entityType: 'todo',
        entityId: 'todo-1',
        offsetMs: TEN_MIN
      })
    ).toThrow(ValidationError)
  })

  it('동일 entity+offset 중복 → create 미호출, update 호출', () => {
    vi.mocked(reminderRepository.findByEntity).mockReturnValue([MOCK_REMINDER_ROW])
    reminderService.set({
      entityType: 'todo',
      entityId: 'todo-1',
      offsetMs: TEN_MIN
    })
    expect(reminderRepository.create).not.toHaveBeenCalled()
    expect(reminderRepository.update).toHaveBeenCalledWith(
      'rem-1',
      expect.objectContaining({ isFired: false })
    )
  })

  it('todo: dueDate 우선 (dueDate+startDate 존재) → dueDate 기반', () => {
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    vi.mocked(todoRepository.findById).mockReturnValue({
      ...MOCK_TODO,
      dueDate,
      startDate
    } as never)
    reminderService.set({ entityType: 'todo', entityId: 'todo-1', offsetMs: TEN_MIN })
    expect(reminderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        remindAt: new Date(dueDate.getTime() - TEN_MIN)
      })
    )
  })

  it('schedule allDay: 09:00 보정', () => {
    const allDayStart = new Date('2026-06-15T00:00:00.000')
    vi.mocked(scheduleRepository.findById).mockReturnValue({
      ...MOCK_SCHEDULE,
      allDay: true,
      startAt: allDayStart
    } as never)
    reminderService.set({ entityType: 'schedule', entityId: 'sch-1', offsetMs: TEN_MIN })
    const expected09 = new Date(allDayStart)
    expected09.setHours(9, 0, 0, 0)
    expect(reminderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        remindAt: new Date(expected09.getTime() - TEN_MIN)
      })
    )
  })

  it('todo: startDate만 존재 (dueDate null) → startDate 기반', () => {
    const startDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    vi.mocked(todoRepository.findById).mockReturnValue({
      ...MOCK_TODO,
      dueDate: null,
      startDate
    } as never)
    reminderService.set({ entityType: 'todo', entityId: 'todo-1', offsetMs: TEN_MIN })
    expect(reminderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        remindAt: new Date(startDate.getTime() - TEN_MIN)
      })
    )
  })

  it('중복 + isFired=true인 기존 알림 → isFired=false 리셋', () => {
    vi.mocked(reminderRepository.findByEntity).mockReturnValue([
      { ...MOCK_REMINDER_ROW, isFired: true }
    ])
    reminderService.set({ entityType: 'todo', entityId: 'todo-1', offsetMs: TEN_MIN })
    expect(reminderRepository.update).toHaveBeenCalledWith(
      'rem-1',
      expect.objectContaining({ isFired: false })
    )
    expect(reminderRepository.create).not.toHaveBeenCalled()
  })

  it('schedule non-allDay → startAt 그대로 (09:00 보정 없음)', () => {
    const startAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    startAt.setHours(14, 30, 0, 0)
    vi.mocked(scheduleRepository.findById).mockReturnValue({
      ...MOCK_SCHEDULE,
      allDay: false,
      startAt
    } as never)
    reminderService.set({ entityType: 'schedule', entityId: 'sch-1', offsetMs: TEN_MIN })
    expect(reminderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        remindAt: new Date(startAt.getTime() - TEN_MIN)
      })
    )
  })
})
```

---

**remove** (2건)

| #   | Case               | 핵심 assertion   |
| --- | ------------------ | ---------------- |
| 1   | 존재하는 알림 삭제 | repo.delete 호출 |
| 2   | 없는 알림          | NotFoundError    |

```typescript
describe('remove', () => {
  it('존재하는 알림 → repo.delete 호출', () => {
    reminderService.remove('rem-1')
    expect(reminderRepository.delete).toHaveBeenCalledWith('rem-1')
  })

  it('없는 알림 → NotFoundError', () => {
    vi.mocked(reminderRepository.findById).mockReturnValue(undefined)
    expect(() => reminderService.remove('no-rem')).toThrow(NotFoundError)
  })
})
```

---

**removeByEntity** (1건)

```typescript
describe('removeByEntity', () => {
  it('repo.deleteByEntity 호출 확인', () => {
    reminderService.removeByEntity('todo', 'todo-1')
    expect(reminderRepository.deleteByEntity).toHaveBeenCalledWith('todo', 'todo-1')
  })
})
```

---

**removeByEntities** (1건)

```typescript
describe('removeByEntities', () => {
  it('repo.deleteByEntities 호출 확인', () => {
    reminderService.removeByEntities('todo', ['t1', 't2'])
    expect(reminderRepository.deleteByEntities).toHaveBeenCalledWith('todo', ['t1', 't2'])
  })
})
```

---

**removeUnfiredByEntity** (1건)

```typescript
describe('removeUnfiredByEntity', () => {
  it('repo.deleteUnfiredByEntity 호출 확인', () => {
    reminderService.removeUnfiredByEntity('schedule', 'sch-1')
    expect(reminderRepository.deleteUnfiredByEntity).toHaveBeenCalledWith('schedule', 'sch-1')
  })
})
```

---

**recalculate** (3건)

| #   | Case                            | 핵심 assertion             |
| --- | ------------------------------- | -------------------------- |
| 1   | baseTime 존재 → remindAt 재계산 | update 호출, isFired=false |
| 2   | baseTime null → 전체 삭제       | deleteByEntity 호출        |
| 3   | 알림 2개 → update 2회           | update 호출 횟수           |

```typescript
describe('recalculate', () => {
  it('baseTime 존재 → update 호출, isFired=false 리셋', () => {
    vi.mocked(reminderRepository.findByEntity).mockReturnValue([MOCK_REMINDER_ROW])
    reminderService.recalculate('todo', 'todo-1')
    expect(reminderRepository.update).toHaveBeenCalledWith(
      'rem-1',
      expect.objectContaining({
        remindAt: new Date(FUTURE.getTime() - TEN_MIN),
        isFired: false
      })
    )
  })

  it('baseTime null → deleteByEntity 호출', () => {
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    reminderService.recalculate('todo', 'todo-1')
    expect(reminderRepository.deleteByEntity).toHaveBeenCalledWith('todo', 'todo-1')
    expect(reminderRepository.update).not.toHaveBeenCalled()
  })

  it('알림 2개 → update 2회 호출', () => {
    vi.mocked(reminderRepository.findByEntity).mockReturnValue([
      MOCK_REMINDER_ROW,
      { ...MOCK_REMINDER_ROW, id: 'rem-2', offsetMs: THIRTY_MIN }
    ])
    reminderService.recalculate('todo', 'todo-1')
    expect(reminderRepository.update).toHaveBeenCalledTimes(2)
  })
})
```

---

**findPendingWithTitle** (3건)

| #   | Case                                | 핵심 assertion   |
| --- | ----------------------------------- | ---------------- |
| 1   | todo 알림 → todo.title 포함         | title 필드 확인  |
| 2   | schedule 알림 → schedule.title 포함 | title 필드 확인  |
| 3   | 삭제된 entity → 폴백 제목           | '(삭제된 할 일)' |

```typescript
describe('findPendingWithTitle', () => {
  it('todo 알림 → todo.title 포함', () => {
    vi.mocked(reminderRepository.findPending).mockReturnValue([MOCK_REMINDER_ROW])
    const result = reminderService.findPendingWithTitle(new Date())
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Test Todo')
  })

  it('schedule 알림 → schedule.title 포함', () => {
    vi.mocked(reminderRepository.findPending).mockReturnValue([
      { ...MOCK_REMINDER_ROW, entityType: 'schedule' as const, entityId: 'sch-1' }
    ])
    const result = reminderService.findPendingWithTitle(new Date())
    expect(result[0].title).toBe('Test Schedule')
  })

  it('삭제된 entity → 폴백 제목', () => {
    vi.mocked(reminderRepository.findPending).mockReturnValue([MOCK_REMINDER_ROW])
    vi.mocked(todoRepository.findById).mockReturnValue(undefined)
    const result = reminderService.findPendingWithTitle(new Date())
    expect(result[0].title).toBe('(삭제된 할 일)')
  })
})
```

---

**markFired** (1건)

```typescript
describe('markFired', () => {
  it('repo.markFired 호출', () => {
    reminderService.markFired('rem-1')
    expect(reminderRepository.markFired).toHaveBeenCalledWith('rem-1', expect.any(Date))
  })
})
```

---

### 파일 3: `src/main/services/__tests__/todo.test.ts` (기존 파일에 추가)

> ⚠️ 기존 파일에 mock 2개 추가 + describe 3개 추가

#### 2.3.1 추가 mock 선언

기존 mock 선언부 (파일 상단, `vi.mock('../entity-link', ...)` 뒤)에 추가:

```typescript
vi.mock('../reminder', () => ({
  reminderService: {
    removeUnfiredByEntity: vi.fn(),
    removeByEntity: vi.fn(),
    removeByEntities: vi.fn(),
    recalculate: vi.fn()
  }
}))

vi.mock('../../repositories/canvas-node', () => ({
  canvasNodeRepository: {
    deleteByRef: vi.fn()
  }
}))
```

import 추가:

```typescript
import { reminderService } from '../reminder'
```

**핵심 설계 판단:**

- 기존 30+ 테스트는 `reminderService`를 호출하는 경로를 통과하지만 mock이 no-op이므로 영향 없음
- `canvasNodeRepository.deleteByRef`도 `remove()`에서 호출되므로 mock 필수
- `canvasNodeRepository` import는 불필요 (직접 assertion 안 함) — `reminderService`만 import

#### 2.3.2 테스트 케이스 (10건)

기존 파일 끝에 3개 describe 블록 추가:

```typescript
describe('update — reminder 연동', () => {
  it('isDone=true → removeUnfiredByEntity 호출', () => {
    todoService.update('todo-1', { isDone: true })
    expect(reminderService.removeUnfiredByEntity).toHaveBeenCalledWith('todo', 'todo-1')
  })

  it('dueDate 변경 → recalculate 호출', () => {
    const newDate = new Date('2026-12-01')
    vi.mocked(todoRepository.findById).mockReturnValue({
      ...MOCK_TODO_ROW,
      dueDate: newDate
    })
    vi.mocked(todoRepository.update).mockReturnValue({
      ...MOCK_TODO_ROW,
      dueDate: newDate
    })
    todoService.update('todo-1', { dueDate: newDate })
    expect(reminderService.recalculate).toHaveBeenCalledWith('todo', 'todo-1')
  })

  it('dueDate+startDate 모두 null → removeByEntity 호출', () => {
    vi.mocked(todoRepository.findById)
      .mockReturnValueOnce(MOCK_TODO_ROW) // 첫 findById (존재 확인)
      .mockReturnValueOnce({ ...MOCK_TODO_ROW, dueDate: null, startDate: null }) // refreshed
    todoService.update('todo-1', { dueDate: null })
    expect(reminderService.removeByEntity).toHaveBeenCalledWith('todo', 'todo-1')
  })

  it('isDone=true + dueDate 변경 → recalculate 미호출 (isDone 가드)', () => {
    todoService.update('todo-1', { isDone: true, dueDate: new Date('2026-12-01') })
    expect(reminderService.removeUnfiredByEntity).toHaveBeenCalled()
    expect(reminderService.recalculate).not.toHaveBeenCalled()
  })

  it('부모 자동완료 → removeUnfiredByEntity(parentId) 호출', () => {
    const subTodo = { ...MOCK_TODO_ROW, id: 'sub-1', parentId: 'par-1' }
    vi.mocked(todoRepository.findById).mockReturnValue(subTodo)
    vi.mocked(todoRepository.update).mockReturnValue(subTodo)
    vi.mocked(todoRepository.findByParentId).mockReturnValue([{ ...subTodo, isDone: false }])
    todoService.update('sub-1', { isDone: true })
    expect(reminderService.removeUnfiredByEntity).toHaveBeenCalledWith('todo', 'sub-1')
    expect(reminderService.removeUnfiredByEntity).toHaveBeenCalledWith('todo', 'par-1')
  })

  it('startDate만 변경 (dueDate 미변경) → recalculate 호출', () => {
    const newStart = new Date('2026-11-01')
    vi.mocked(todoRepository.findById).mockReturnValue({
      ...MOCK_TODO_ROW,
      startDate: newStart
    })
    vi.mocked(todoRepository.update).mockReturnValue({
      ...MOCK_TODO_ROW,
      startDate: newStart
    })
    todoService.update('todo-1', { startDate: newStart })
    expect(reminderService.recalculate).toHaveBeenCalledWith('todo', 'todo-1')
  })

  it("status='완료' → removeUnfiredByEntity 호출", () => {
    todoService.update('todo-1', { status: '완료' })
    expect(reminderService.removeUnfiredByEntity).toHaveBeenCalledWith('todo', 'todo-1')
  })
})

describe('reorderKanban — reminder 연동', () => {
  it('완료 이동 → removeUnfiredByEntity 호출', () => {
    todoService.reorderKanban('ws-1', [{ id: 'todo-1', order: 0, status: '완료' }])
    expect(reminderService.removeUnfiredByEntity).toHaveBeenCalledWith('todo', 'todo-1')
  })

  it('혼합 status → 완료만 알림 삭제', () => {
    todoService.reorderKanban('ws-1', [
      { id: 't1', order: 0, status: '완료' },
      { id: 't2', order: 1, status: '할일' },
      { id: 't3', order: 2 }
    ])
    expect(reminderService.removeUnfiredByEntity).toHaveBeenCalledTimes(1)
    expect(reminderService.removeUnfiredByEntity).toHaveBeenCalledWith('todo', 't1')
  })
})

describe('remove — reminder 연동', () => {
  it('removeByEntities 호출 (본인 + 하위)', () => {
    vi.mocked(todoRepository.findAllDescendantIds).mockReturnValue(['sub-1', 'sub-2'])
    todoService.remove('todo-1')
    expect(reminderService.removeByEntities).toHaveBeenCalledWith('todo', [
      'todo-1',
      'sub-1',
      'sub-2'
    ])
  })
})
```

---

### 파일 4: `src/main/services/__tests__/schedule.test.ts` (신규 생성)

> ⚠️ `schedule.test.ts`가 존재하지 않음 → 신규 생성
> reminder 연동 검증에 초점. scheduleService 전체 테스트는 별도 범위.

#### 2.4.1 import & mock & 픽스처

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { scheduleService } from '../schedule'
import { scheduleRepository } from '../../repositories/schedule'
import { workspaceRepository } from '../../repositories/workspace'
import { reminderService } from '../reminder'

vi.mock('../../repositories/schedule', () => ({
  scheduleRepository: {
    findById: vi.fn(),
    findByWorkspaceId: vi.fn(),
    findAllByWorkspaceId: vi.fn(),
    findByIds: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

vi.mock('../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

vi.mock('../../repositories/schedule-todo', () => ({
  scheduleTodoRepository: {
    link: vi.fn(),
    unlink: vi.fn(),
    findTodosByScheduleId: vi.fn()
  }
}))

vi.mock('../../repositories/todo', () => ({
  todoRepository: { findById: vi.fn() }
}))

vi.mock('../entity-link', () => ({
  entityLinkService: {
    removeAllLinks: vi.fn()
  }
}))

vi.mock('../../repositories/canvas-node', () => ({
  canvasNodeRepository: {
    deleteByRef: vi.fn()
  }
}))

vi.mock('../reminder', () => ({
  reminderService: {
    recalculate: vi.fn(),
    removeByEntity: vi.fn()
  }
}))

vi.mock('nanoid', () => ({ nanoid: () => 'mock-id' }))

// ── Fixtures ──

const MOCK_WS = {
  id: 'ws-1',
  name: 'T',
  path: '/t',
  createdAt: new Date(),
  updatedAt: new Date()
}

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000)

const MOCK_SCHEDULE_ROW = {
  id: 'sch-1',
  workspaceId: 'ws-1',
  title: 'Test',
  description: null,
  location: null,
  allDay: false,
  startAt: FUTURE,
  endAt: new Date(FUTURE.getTime() + 60 * 60 * 1000),
  color: null,
  priority: 'medium' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  vi.mocked(scheduleRepository.findById).mockReturnValue(MOCK_SCHEDULE_ROW)
  vi.mocked(scheduleRepository.update).mockReturnValue(MOCK_SCHEDULE_ROW)
})
```

#### 2.4.2 테스트 케이스 (6건)

```typescript
describe('update — reminder 연동', () => {
  it('startAt 변경 → recalculate 호출', () => {
    const newStart = new Date(FUTURE.getTime() + 2 * 60 * 60 * 1000)
    scheduleService.update('sch-1', { startAt: newStart })
    expect(reminderService.recalculate).toHaveBeenCalledWith('schedule', 'sch-1')
  })

  it('allDay 변경 → recalculate 호출', () => {
    scheduleService.update('sch-1', { allDay: true })
    expect(reminderService.recalculate).toHaveBeenCalledWith('schedule', 'sch-1')
  })

  it('title만 변경 → recalculate 미호출', () => {
    scheduleService.update('sch-1', { title: '새 제목' })
    expect(reminderService.recalculate).not.toHaveBeenCalled()
  })

  it('endAt만 변경 → recalculate 미호출', () => {
    scheduleService.update('sch-1', {
      endAt: new Date(FUTURE.getTime() + 3 * 60 * 60 * 1000)
    })
    expect(reminderService.recalculate).not.toHaveBeenCalled()
  })
})

describe('move — reminder 연동', () => {
  it('move → recalculate 호출', () => {
    const newStart = new Date(FUTURE.getTime() + 24 * 60 * 60 * 1000)
    const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000)
    scheduleService.move('sch-1', newStart, newEnd)
    expect(reminderService.recalculate).toHaveBeenCalledWith('schedule', 'sch-1')
  })
})

describe('remove — reminder 연동', () => {
  it('removeByEntity 호출 후 삭제', () => {
    scheduleService.remove('sch-1')
    expect(reminderService.removeByEntity).toHaveBeenCalledWith('schedule', 'sch-1')
  })
})
```

---

## 3. 테스트 케이스 요약

| 파일                          | describe                      | cases  |
| ----------------------------- | ----------------------------- | :----: |
| reminder.test.ts (repository) | findByEntity                  |   3    |
|                               | findPending                   |   3    |
|                               | findById                      |   2    |
|                               | create                        |   1    |
|                               | update                        |   2    |
|                               | markFired                     |   1    |
|                               | delete                        |   1    |
|                               | deleteByEntity                |   2    |
|                               | deleteByEntities              |   2    |
|                               | deleteUnfiredByEntity         |   2    |
| reminder.test.ts (service)    | findByEntity                  |   1    |
|                               | set                           |   10   |
|                               | remove                        |   2    |
|                               | removeByEntity                |   1    |
|                               | removeByEntities              |   1    |
|                               | removeUnfiredByEntity         |   1    |
|                               | recalculate                   |   3    |
|                               | findPendingWithTitle          |   3    |
|                               | markFired                     |   1    |
| todo.test.ts (추가)           | update — reminder 연동        |   7    |
|                               | reorderKanban — reminder 연동 |   2    |
|                               | remove — reminder 연동        |   1    |
| schedule.test.ts (신규)       | update — reminder 연동        |   4    |
|                               | move — reminder 연동          |   1    |
|                               | remove — reminder 연동        |   1    |
| **Total**                     |                               | **61** |

---

## 4. 주의사항

- `setup.ts`의 `beforeEach`가 `reminders` 테이블을 초기화하지 않음 → repository 테스트에서 자체 `testDb.delete(schema.reminders).run()` 필수
- `todo.test.ts`에 `reminderService` + `canvasNodeRepository` mock 추가 시 기존 30+ 테스트에 영향 없음 확인 (mock은 no-op `vi.fn()`)
- `schedule.test.ts`는 신규 파일 → `scheduleService`의 모든 의존성 (7개 모듈: schedule, workspace, schedule-todo, todo, entity-link, canvas-node, reminder) mock 필요
- `remindAt` 비교 시 `getTime()` 사용 — `timestamp_ms` 모드에서 Date↔number 변환 정밀도 보장
- `FUTURE` 날짜는 `Date.now() + 1일`로 항상 미래 보장 → `set()` 과거 시각 검증에서 별도 과거 Date 사용
- `reminderRepository.findByEntity` 기본 빈 배열 → `set()` 중복 검사 기본 통과, 중복 테스트에서 `mockReturnValue` 오버라이드
- `todo.test.ts` 기존 `remove` 테스트 5건이 `entityLinkService.removeAllLinksForTodos` 호출을 검증하는데, `canvasNodeRepository.deleteByRef` mock이 없으면 실패함 → mock 추가가 기존 테스트 정상 동작의 전제 조건
