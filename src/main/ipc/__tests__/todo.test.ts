/**
 * todo IPC 핸들러 회귀 + 런타임 검증 테스트.
 *
 * 모든 핸들러가 `validateIpc([...schemas], handler)` 로 감싸진다.
 * 검증 포인트: (1) 채널이 정확한 이름으로 등록 (2) 유효 입력은 service 로 위임
 * (3) 성공 시 successResponse 래핑 (4) 잘못된 입력은 service 에 닿기 전 errorResponse.
 * (5) Date/null/undefined 직렬화 호환.
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

// validateIpc(idSchema) 통과용 — nanoid 형식(≥8, URL-safe).
const WS = 'ws-aabbcc12'
const TODO_ID = 'todo-aabb1'
const PARENT_ID = 'parent-aa1'

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

    const result = handler({}, WS, { filter: 'active' })

    expect(todoService.findByWorkspace).toHaveBeenCalledWith(WS, 'active')
    expect(result).toEqual({ success: true, data: [] })
  })

  it('todo:findByWorkspace → options 미지정 시 filter undefined', () => {
    vi.mocked(todoService.findByWorkspace).mockReturnValue([])
    getHandler('todo:findByWorkspace')({}, WS)
    expect(todoService.findByWorkspace).toHaveBeenCalledWith(WS, undefined)
  })

  it('todo:create → service throw → errorResponse 래핑', () => {
    vi.mocked(todoService.create).mockImplementation(() => {
      throw new ValidationError('bad')
    })

    const result = getHandler<{ success: boolean }>('todo:create')({}, WS, { title: 'x' })

    expect(result).toMatchObject({ success: false })
  })

  it('todo:reorderList → updates 배열 그대로 전달', () => {
    const updates = [{ id: TODO_ID, order: 0 }]
    getHandler('todo:reorderList')({}, WS, updates)
    expect(todoService.reorderList).toHaveBeenCalledWith(WS, updates)
  })

  it('todo:reorderSub → parentId + updates 전달', () => {
    const updates = [{ id: 'child-aa01', order: 0 }]
    getHandler('todo:reorderSub')({}, PARENT_ID, updates)
    expect(todoService.reorderSub).toHaveBeenCalledWith(PARENT_ID, updates)
  })
})

describe('todo IPC 런타임 입력 검증 (실패 케이스)', () => {
  it('잘못된 workspaceId 형식(너무 짧음) → service 미호출 + errorResponse', () => {
    const result = getHandler<{ success: boolean }>('todo:create')({}, 'x', { title: 'a' })
    expect(result).toMatchObject({ success: false })
    expect(todoService.create).not.toHaveBeenCalled()
  })

  it('빈 title → errorResponse', () => {
    const result = getHandler<{ success: boolean }>('todo:create')({}, WS, { title: '   ' })
    expect(result).toMatchObject({ success: false })
    expect(todoService.create).not.toHaveBeenCalled()
  })

  it('잘못된 status enum → errorResponse', () => {
    const result = getHandler<{ success: boolean }>('todo:create')({}, WS, {
      title: 'a',
      status: 'INVALID'
    })
    expect(result).toMatchObject({ success: false })
    expect(todoService.create).not.toHaveBeenCalled()
  })

  it('reorder updates 의 id 형식 불량 → errorResponse', () => {
    const result = getHandler<{ success: boolean }>('todo:reorderList')({}, WS, [
      { id: 'x', order: 0 }
    ])
    expect(result).toMatchObject({ success: false })
    expect(todoService.reorderList).not.toHaveBeenCalled()
  })

  it('updates 가 배열이 아님 → errorResponse', () => {
    const result = getHandler<{ success: boolean }>('todo:reorderList')({}, WS, { id: TODO_ID })
    expect(result).toMatchObject({ success: false })
    expect(todoService.reorderList).not.toHaveBeenCalled()
  })

  it('findByDateRange 의 range 가 Date 로 강제 불가한 값 → errorResponse', () => {
    const result = getHandler<{ success: boolean }>('todo:findByDateRange')({}, WS, {
      start: 'not-a-date',
      end: 'also-bad'
    })
    expect(result).toMatchObject({ success: false })
    expect(todoService.findByWorkspaceAndDateRange).not.toHaveBeenCalled()
  })
})

describe('todo IPC Date/null/undefined 직렬화 호환', () => {
  it('dueDate 를 Date 객체로 전달 (structured clone 경로)', () => {
    const due = new Date('2026-01-01T00:00:00.000Z')
    getHandler('todo:create')({}, WS, { title: 'a', dueDate: due })
    const [, data] = vi.mocked(todoService.create).mock.calls[0]
    expect(data.dueDate).toBeInstanceOf(Date)
    expect((data.dueDate as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('dueDate 를 ISO 문자열로 전달 → Date 로 coerce (직렬화 경로)', () => {
    getHandler('todo:create')({}, WS, { title: 'a', dueDate: '2026-01-01T00:00:00.000Z' })
    const [, data] = vi.mocked(todoService.create).mock.calls[0]
    expect(data.dueDate).toBeInstanceOf(Date)
  })

  it('dueDate=null (명시적 해제) 허용', () => {
    getHandler('todo:update')({}, TODO_ID, { dueDate: null })
    const [, data] = vi.mocked(todoService.update).mock.calls[0]
    expect(data.dueDate).toBeNull()
  })

  it('dueDate 키 미전달 (undefined) → data 에 dueDate 없음', () => {
    getHandler('todo:update')({}, TODO_ID, { title: 'a' })
    const [, data] = vi.mocked(todoService.update).mock.calls[0]
    expect(data.dueDate).toBeUndefined()
  })
})
