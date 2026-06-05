/**
 * schedule IPC 핸들러 회귀 테스트.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => makeIpcMainMock())

vi.mock('../../services/schedule', () => ({
  scheduleService: {
    findAllByWorkspace: vi.fn(),
    findByWorkspace: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    linkTodo: vi.fn(),
    unlinkTodo: vi.fn(),
    getLinkedTodos: vi.fn()
  }
}))

import { registerScheduleHandlers } from '../schedule'
import { scheduleService } from '../../services/schedule'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerScheduleHandlers()
})

describe('schedule IPC handlers', () => {
  it('10개 채널 등록', () => {
    const channels = [
      'schedule:findAllByWorkspace',
      'schedule:findByWorkspace',
      'schedule:findById',
      'schedule:create',
      'schedule:update',
      'schedule:remove',
      'schedule:move',
      'schedule:linkTodo',
      'schedule:unlinkTodo',
      'schedule:getLinkedTodos'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('schedule:findByWorkspace → range 객체 전달', () => {
    const range = { start: new Date('2026-05-01'), end: new Date('2026-05-31') }
    vi.mocked(scheduleService.findByWorkspace).mockReturnValue([])
    getHandler('schedule:findByWorkspace')({}, 'ws-aabbcc12', range)
    expect(scheduleService.findByWorkspace).toHaveBeenCalledWith('ws-aabbcc12', range)
  })

  it('schedule:move → scheduleId + startAt + endAt 전달', () => {
    const start = new Date('2026-05-29T09:00:00Z')
    const end = new Date('2026-05-29T10:00:00Z')
    getHandler('schedule:move')({}, 'sch-aabbcc1', start, end)
    expect(scheduleService.move).toHaveBeenCalledWith('sch-aabbcc1', start, end)
  })

  it('schedule:linkTodo → scheduleId + todoId 전달', () => {
    getHandler('schedule:linkTodo')({}, 'sch-aabbcc1', 'todo-aabbcc')
    expect(scheduleService.linkTodo).toHaveBeenCalledWith('sch-aabbcc1', 'todo-aabbcc')
  })

  it('schedule:create → workspace + data 전달 + 결과 래핑', () => {
    vi.mocked(scheduleService.create).mockReturnValue({ id: 'sch-newaabb' } as ReturnType<
      typeof scheduleService.create
    >)
    const startAt = new Date('2026-06-01T10:00:00.000Z')
    const endAt = new Date('2026-06-01T11:00:00.000Z')
    const result = getHandler('schedule:create')({}, 'ws-aabbcc12', {
      title: 'meeting',
      startAt,
      endAt
    })
    expect(scheduleService.create).toHaveBeenCalledWith('ws-aabbcc12', {
      title: 'meeting',
      startAt,
      endAt
    })
    expect(result).toMatchObject({ success: true })
  })
})
