/**
 * todo IPC 핸들러 회귀 테스트.
 *
 * 모든 핸들러가 `handle(() => todoService.method(...args))` 라는 균일한 패턴.
 * 검증 포인트: (1) 채널이 정확한 이름으로 등록 (2) 인자가 service 로 그대로 전달
 * (3) 성공 시 successResponse 래핑 (4) throw 시 errorResponse 래핑.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcHandlers, getHandler, makeIpcMainMock } from './_ipc-mock'

vi.mock('electron', () => makeIpcMainMock())

vi.mock('../../services/todo', () => ({
  todoService: {
    findByWorkspace: vi.fn(),
    findByWorkspaceAndDateRange: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    reorderList: vi.fn(),
    reorderKanban: vi.fn(),
    reorderSub: vi.fn(),
    findCompletedWithRecurring: vi.fn()
  }
}))

import { registerTodoHandlers } from '../todo'
import { todoService } from '../../services/todo'
import { ValidationError } from '../../lib/errors'

beforeEach(() => {
  ipcHandlers.clear()
  vi.clearAllMocks()
  registerTodoHandlers()
})

describe('todo IPC handlers', () => {
  it('9개 채널 모두 등록', () => {
    const channels = [
      'todo:findByWorkspace',
      'todo:findByDateRange',
      'todo:create',
      'todo:update',
      'todo:remove',
      'todo:reorderList',
      'todo:reorderKanban',
      'todo:reorderSub',
      'todo:findCompletedWithRecurring'
    ]
    for (const ch of channels) {
      expect(ipcHandlers.has(ch)).toBe(true)
    }
  })

  it('todo:findByWorkspace → service 위임 + filter 옵션 전달', () => {
    vi.mocked(todoService.findByWorkspace).mockReturnValue([])
    const handler = getHandler('todo:findByWorkspace')

    const result = handler({}, 'ws-aabbcc12', { filter: 'active' })

    expect(todoService.findByWorkspace).toHaveBeenCalledWith('ws-aabbcc12', 'active')
    expect(result).toEqual({ success: true, data: [] })
  })

  it('todo:findByWorkspace → options 미지정 시 filter undefined', () => {
    vi.mocked(todoService.findByWorkspace).mockReturnValue([])
    getHandler('todo:findByWorkspace')({}, 'ws-aabbcc12')
    expect(todoService.findByWorkspace).toHaveBeenCalledWith('ws-aabbcc12', undefined)
  })

  it('todo:create → service throw → errorResponse 래핑', () => {
    vi.mocked(todoService.create).mockImplementation(() => {
      throw new ValidationError('bad')
    })

    const result = getHandler<{ success: boolean }>('todo:create')(
      {},
      'ws-aabbcc12',
      { title: 'x' }
    )

    expect(result).toMatchObject({ success: false })
  })

  it('todo:reorderList → updates 배열 그대로 전달', () => {
    const updates = [{ id: 't1', order: 0 }]
    getHandler('todo:reorderList')({}, 'ws-aabbcc12', updates)
    expect(todoService.reorderList).toHaveBeenCalledWith('ws-aabbcc12', updates)
  })

  it('todo:reorderSub → parentId + updates 전달', () => {
    const updates = [{ id: 'c1', subOrder: 0 }]
    getHandler('todo:reorderSub')({}, 'parent-1', updates)
    expect(todoService.reorderSub).toHaveBeenCalledWith('parent-1', updates)
  })
})
