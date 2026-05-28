/**
 * MCP history 라우트 단위 테스트.
 * - GET /api/mcp/history → historyService.fetch 위임 + 파라미터 파싱/검증
 *
 * historyService 와 helpers/resolveActiveWorkspace 만 모킹해 라우트 자체의
 * 입력 파싱·직렬화 로직을 모두 통과시킨다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpHistoryRoutes } from '../history'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

vi.mock('../../../../services/history', () => ({
  historyService: {
    fetch: vi.fn()
  }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: {
    getActiveWorkspaceId: vi.fn()
  }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: {
    findById: vi.fn()
  }
}))

import { historyService } from '../../../../services/history'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.clearAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpHistoryRoutes(router)
  return router
}

describe('GET /api/mcp/history', () => {
  it('파라미터 없이 호출 → service 에 undefined 전달, 응답 직렬화', async () => {
    vi.mocked(historyService.fetch).mockReturnValue({
      days: [
        {
          date: '2026-05-01',
          todos: [
            {
              id: 't1',
              title: 'A',
              doneAt: new Date('2026-05-01T10:00:00Z'),
              kind: 'todo',
              links: []
            }
          ]
        }
      ],
      hasMore: false,
      nextDayOffset: null
    })

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/history', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(historyService.fetch).toHaveBeenCalledWith(WS.id, {
      dayOffset: undefined,
      dayLimit: undefined,
      fromDate: undefined,
      toDate: undefined,
      query: undefined
    })
    const body = cap.getJson<{
      days: { date: string; todos: { id: string; doneAt: string }[] }[]
      hasMore: boolean
    }>()
    expect(body.hasMore).toBe(false)
    expect(body.days[0].todos[0].doneAt).toBe('2026-05-01T10:00:00.000Z')
  })

  it('정상 query 파라미터 → service 로 전달', async () => {
    vi.mocked(historyService.fetch).mockReturnValue({
      days: [],
      hasMore: true,
      nextDayOffset: 10
    })

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/history?dayOffset=5&dayLimit=10&fromDate=2026-04-01&toDate=2026-05-31&query=foo',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(historyService.fetch).toHaveBeenCalledWith(WS.id, {
      dayOffset: 5,
      dayLimit: 10,
      fromDate: '2026-04-01',
      toDate: '2026-05-31',
      query: 'foo'
    })
    expect(cap.getJson<{ nextDayOffset: number }>().nextDayOffset).toBe(10)
  })

  it('dayOffset 이 정수 아닌 경우 → 400 ValidationError', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/history?dayOffset=abc',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
    expect(cap.getJson<{ code: string }>().code).toBe('VALIDATION')
  })

  it('dayOffset 이 음수 → 400 ValidationError', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/history?dayOffset=-1',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('fromDate 형식이 YYYY-MM-DD 아님 → 400 ValidationError', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/history?fromDate=2026/05/01',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
    expect(cap.getJson<{ code: string }>().code).toBe('VALIDATION')
  })

  it('활성 워크스페이스 없음 → 400 ValidationError', async () => {
    vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(null)

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/history', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('인증 토큰 없음 → 401', async () => {
    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/history' })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(401)
  })
})
