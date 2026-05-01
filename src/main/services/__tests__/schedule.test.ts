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
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  trashBatchId: null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workspaceRepository.findById).mockReturnValue(MOCK_WS)
  vi.mocked(scheduleRepository.findById).mockReturnValue(MOCK_SCHEDULE_ROW)
  vi.mocked(scheduleRepository.update).mockReturnValue(MOCK_SCHEDULE_ROW)
})

describe('update — reminder 연동', () => {
  it('startAt 변경 → recalculate 호출', () => {
    const newStart = new Date(FUTURE.getTime() + 30 * 60 * 1000) // endAt(+1h) 이전
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
    scheduleService.remove('sch-1', { permanent: true })
    expect(reminderService.removeByEntity).toHaveBeenCalledWith('schedule', 'sch-1')
  })
})
