/**
 * MCP reminders 라우트 단위 테스트.
 * - GET  /api/mcp/reminders        (entity-scoped 또는 ws 전체, pendingOnly filter)
 * - POST /api/mcp/reminders/batch  (create / delete + 소유권 가드)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpReminderRoutes } from '../reminders'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/reminder', () => ({
  reminderService: {
    findByEntity: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../../repositories/reminder', () => ({
  reminderRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/todo', () => ({
  todoRepository: {
    findById: vi.fn(),
    findByWorkspaceWithFilters: vi.fn()
  }
}))
vi.mock('../../../../repositories/schedule', () => ({
  scheduleRepository: {
    findById: vi.fn(),
    findAllByWorkspaceId: vi.fn()
  }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { reminderService } from '../../../../services/reminder'
import { reminderRepository } from '../../../../repositories/reminder'
import { todoRepository } from '../../../../repositories/todo'
import { scheduleRepository } from '../../../../repositories/schedule'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type Reminder = NonNullable<ReturnType<typeof reminderRepository.findById>>
type ReminderFromService = ReturnType<typeof reminderService.set>
type TodoRow = NonNullable<ReturnType<typeof todoRepository.findById>>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const TODO = {
  id: 'todo-aabbcc1',
  workspaceId: WS.id,
  title: 't',
  description: null,
  status: '진행중',
  priority: 'medium',
  parentId: null,
  isDone: false,
  dueDate: null,
  startDate: null,
  doneAt: null,
  order: 0,
  subOrder: 0,
  kanbanOrder: 0,
  listOrder: 0,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as TodoRow

const REMINDER = {
  id: 'rem-aabbcc12',
  entityType: 'todo',
  entityId: TODO.id,
  offsetMs: -300000,
  remindAt: new Date('2026-05-29T08:55:00Z'),
  isFired: false,
  createdAt: new Date(),
  updatedAt: new Date()
} as unknown as Reminder

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.resetAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(reminderService.findByEntity).mockReturnValue([])
  vi.mocked(todoRepository.findByWorkspaceWithFilters).mockReturnValue([])
  vi.mocked(scheduleRepository.findAllByWorkspaceId).mockReturnValue([])
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpReminderRoutes(router)
  return router
}

describe('GET /api/mcp/reminders', () => {
  it('entityType + entityId → 해당 entity 의 reminder 만 + 소유권 검증', async () => {
    vi.mocked(todoRepository.findById).mockReturnValue(TODO)
    vi.mocked(reminderService.findByEntity).mockReturnValue([REMINDER])

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/reminders?entityType=todo&entityId=${TODO.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(reminderService.findByEntity).toHaveBeenCalledWith('todo', TODO.id)
    const body = cap.getJson<{ reminders: { id: string; remindAt: string }[] }>()
    expect(body.reminders[0].remindAt).toBe('2026-05-29T08:55:00.000Z')
  })

  it('잘못된 entityType → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/reminders?entityType=bogus&entityId=t-abcdefgh',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('다른 워크스페이스의 todo → 404', async () => {
    vi.mocked(todoRepository.findById).mockReturnValue({
      ...TODO,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as TodoRow)

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/reminders?entityType=todo&entityId=${TODO.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(404)
  })

  it('entity 미지정 → 워크스페이스 전체 reminder 수집 + pendingOnly 필터', async () => {
    vi.mocked(todoRepository.findByWorkspaceWithFilters).mockReturnValue([TODO])
    vi.mocked(reminderService.findByEntity).mockImplementation((_type: string, _id: string) => [
      REMINDER,
      { ...REMINDER, id: 'rem-fired001', isFired: true } as unknown as Reminder
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/reminders?pendingOnly=true',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ reminders: { id: string; isFired: boolean }[] }>()
    expect(body.reminders.every((r) => !r.isFired)).toBe(true)
    expect(body.reminders).toHaveLength(1)
  })
})

describe('POST /api/mcp/reminders/batch', () => {
  it('create → reminderService.set + reminder:changed broadcast', async () => {
    vi.mocked(todoRepository.findById).mockReturnValue(TODO)
    vi.mocked(reminderService.set).mockReturnValue(REMINDER as unknown as ReminderFromService)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/reminders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'create',
            entityType: 'todo',
            entityId: TODO.id,
            offsetMs: -300000
          }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(reminderService.set).toHaveBeenCalled()
    expect(broadcastMock).toHaveBeenCalledWith('reminder:changed', WS.id, [])
  })

  it('create 시 잘못된 entityType → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/reminders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [{ action: 'create', entityType: 'bogus', entityId: TODO.id, offsetMs: -1000 }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('delete → 소유권 확인 후 remove', async () => {
    vi.mocked(reminderRepository.findById).mockReturnValue(REMINDER)
    vi.mocked(todoRepository.findById).mockReturnValue(TODO)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/reminders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: REMINDER.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(reminderService.remove).toHaveBeenCalledWith(REMINDER.id)
  })

  it('delete 시 존재하지 않는 reminder → 404 (전체 batch fail)', async () => {
    vi.mocked(reminderRepository.findById).mockReturnValue(undefined)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/reminders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: 'rem-missing1' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
    expect(reminderService.remove).not.toHaveBeenCalled()
  })
})
