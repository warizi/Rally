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
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000)

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

describe('removeByEntity', () => {
  it('repo.deleteByEntity 호출 확인', () => {
    reminderService.removeByEntity('todo', 'todo-1')
    expect(reminderRepository.deleteByEntity).toHaveBeenCalledWith('todo', 'todo-1')
  })
})

describe('removeByEntities', () => {
  it('repo.deleteByEntities 호출 확인', () => {
    reminderService.removeByEntities('todo', ['t1', 't2'])
    expect(reminderRepository.deleteByEntities).toHaveBeenCalledWith('todo', ['t1', 't2'])
  })
})

describe('removeUnfiredByEntity', () => {
  it('repo.deleteUnfiredByEntity 호출 확인', () => {
    reminderService.removeUnfiredByEntity('schedule', 'sch-1')
    expect(reminderRepository.deleteUnfiredByEntity).toHaveBeenCalledWith('schedule', 'sch-1')
  })
})

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

describe('markFired', () => {
  it('repo.markFired 호출', () => {
    reminderService.markFired('rem-1')
    expect(reminderRepository.markFired).toHaveBeenCalledWith('rem-1', expect.any(Date))
  })
})
