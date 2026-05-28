/**
 * MCP schedules 라우트 단위 테스트.
 * - GET  /api/mcp/schedules          (list_schedules + from/to/search)
 * - POST /api/mcp/schedules/batch    (manage_schedules: create/update/delete)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpScheduleRoutes } from '../schedules'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/schedule', () => ({
  scheduleService: {
    findByWorkspace: vi.fn(),
    findAllByWorkspace: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../../repositories/schedule', () => ({
  scheduleRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { scheduleService } from '../../../../services/schedule'
import { scheduleRepository } from '../../../../repositories/schedule'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type Schedule = NonNullable<ReturnType<typeof scheduleRepository.findById>>
type ScheduleFromService = ReturnType<typeof scheduleService.create>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const SCHEDULE = {
  id: 'sched-aabbcc1',
  workspaceId: WS.id,
  title: 'Standup',
  description: 'desc',
  location: 'office',
  allDay: false,
  startAt: new Date('2026-05-29T09:00:00Z'),
  endAt: new Date('2026-05-29T09:30:00Z'),
  color: '#1f6feb',
  priority: 'medium',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null,
  deletedAt: null
} as unknown as Schedule

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.resetAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(scheduleService.findAllByWorkspace).mockReturnValue([])
  vi.mocked(scheduleService.findByWorkspace).mockReturnValue([])
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpScheduleRoutes(router)
  return router
}

describe('GET /api/mcp/schedules', () => {
  it('from/to 없음 → findAllByWorkspace 사용', async () => {
    vi.mocked(scheduleService.findAllByWorkspace).mockReturnValue([SCHEDULE as unknown as Schedule])

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/schedules', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(scheduleService.findAllByWorkspace).toHaveBeenCalledWith(WS.id)
    const body = cap.getJson<{ schedules: { id: string; startAt: string }[] }>()
    expect(body.schedules[0].startAt).toBe('2026-05-29T09:00:00.000Z')
  })

  it('from+to 같이 지정 → findByWorkspace(range) 사용', async () => {
    vi.mocked(scheduleService.findByWorkspace).mockReturnValue([])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/schedules?from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(scheduleService.findByWorkspace).toHaveBeenCalled()
  })

  it('search → title/description/location 매치 필터', async () => {
    vi.mocked(scheduleService.findAllByWorkspace).mockReturnValue([
      SCHEDULE as unknown as Schedule,
      { ...SCHEDULE, id: 'sched-other12', title: 'Other', description: '', location: '' } as unknown as Schedule
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/schedules?search=standup',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ schedules: { id: string }[] }>()
    expect(body.schedules).toHaveLength(1)
    expect(body.schedules[0].id).toBe(SCHEDULE.id)
  })

  it('잘못된 from 날짜 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/schedules?from=not-a-date',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('POST /api/mcp/schedules/batch', () => {
  it('create → 정상 처리 + broadcast', async () => {
    vi.mocked(scheduleService.create).mockReturnValue(SCHEDULE as unknown as ScheduleFromService)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/schedules/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'create',
            title: 'meeting',
            startAt: '2026-05-29T09:00:00Z',
            endAt: '2026-05-29T10:00:00Z',
            priority: 'medium'
          }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(broadcastMock).toHaveBeenCalledWith('schedule:changed', WS.id, [])
  })

  it('create 시 startAt 누락 → 400 (batch fail)', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/schedules/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          { action: 'create', title: 'no time', endAt: '2026-05-29T10:00:00Z', priority: 'medium' }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('update on 존재하지 않는 id → 404 (전체 batch fail)', async () => {
    vi.mocked(scheduleRepository.findById).mockReturnValue(undefined)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/schedules/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [{ action: 'update', id: 'sched-missing1', title: 'x' }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('delete on 다른 워크스페이스 → 404 (정보 노출 방지)', async () => {
    vi.mocked(scheduleRepository.findById).mockReturnValue({
      ...SCHEDULE,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as Schedule)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/schedules/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: SCHEDULE.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
    expect(scheduleService.remove).not.toHaveBeenCalled()
  })

  it('empty actions → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/schedules/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })
})
