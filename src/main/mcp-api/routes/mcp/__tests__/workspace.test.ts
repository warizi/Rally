/**
 * MCP workspace 라우트 단위 테스트.
 * - GET /api/mcp/workspaces (list)
 * - POST /api/mcp/workspace/switch (switch + broadcast)
 *
 * router 의 인증 미들웨어 + envelope 까지 통과시켜 실제 HTTP 응답을 검증.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpWorkspaceRoutes } from '../workspace'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

// Electron 의 BrowserWindow 를 사용하지 않도록 broadcast 모듈을 모킹.
// vi.mock 은 hoist 되므로 vi.hoisted 로 안전하게 mock 함수를 공유.
const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({
  broadcastChanged: broadcastMock
}))

vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: {
    findAll: vi.fn(),
    findById: vi.fn()
  }
}))

vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: {
    getActiveWorkspaceId: vi.fn(),
    ensureWatching: vi.fn()
  }
}))

import { workspaceRepository } from '../../../../repositories/workspace'
import { workspaceWatcher } from '../../../../services/workspace-watcher'

const ws1 = {
  id: 'ws-1-aaaaaaaaaa',
  name: 'Alpha',
  path: '/path/alpha',
  createdAt: new Date(),
  updatedAt: new Date()
}
const ws2 = {
  id: 'ws-2-bbbbbbbbbb',
  name: 'Beta',
  path: '/path/beta',
  createdAt: new Date(),
  updatedAt: new Date()
}

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.clearAllMocks()
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) {
    delete process.env.MCP_AUTH_TOKEN
  } else {
    process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
  }
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpWorkspaceRoutes(router)
  return router
}

describe('GET /api/mcp/workspaces (list)', () => {
  it('전체 워크스페이스 목록 + active flag 를 반환', async () => {
    vi.mocked(workspaceRepository.findAll).mockReturnValue([ws1, ws2])
    vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(ws2.id)

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/workspaces', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ workspaces: { id: string; active: boolean }[] }>()
    expect(body.workspaces).toHaveLength(2)
    expect(body.workspaces[0]).toEqual({
      id: ws1.id,
      name: ws1.name,
      path: ws1.path,
      active: false
    })
    expect(body.workspaces[1].active).toBe(true)
  })

  it('활성 워크스페이스가 없어도 동작 (모든 active:false)', async () => {
    vi.mocked(workspaceRepository.findAll).mockReturnValue([ws1])
    vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(null)

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/workspaces', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ workspaces: { active: boolean }[] }>()
    expect(body.workspaces[0].active).toBe(false)
  })

  it('워크스페이스가 0개여도 빈 배열 반환', async () => {
    vi.mocked(workspaceRepository.findAll).mockReturnValue([])
    vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(null)

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/workspaces', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(cap.getJson<{ workspaces: unknown[] }>().workspaces).toEqual([])
  })
})

describe('POST /api/mcp/workspace/switch', () => {
  it('정상 전환 → ensureWatching + broadcast', async () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(ws2)
    vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(ws1.id)
    vi.mocked(workspaceWatcher.ensureWatching).mockResolvedValue(undefined)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/workspace/switch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { workspaceId: ws2.id }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{
      workspace: { id: string; active: boolean }
      alreadyActive: boolean
    }>()
    expect(body.workspace).toEqual({
      id: ws2.id,
      name: ws2.name,
      path: ws2.path,
      active: true
    })
    expect(body.alreadyActive).toBe(false)
    expect(workspaceWatcher.ensureWatching).toHaveBeenCalledWith(ws2.id, ws2.path)
    expect(broadcastMock).toHaveBeenCalledWith('workspace:active-changed', ws2.id, [])
  })

  it('이미 활성 상태인 워크스페이스 → no-op (alreadyActive:true, broadcast 안 함)', async () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(ws1)
    vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(ws1.id)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/workspace/switch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { workspaceId: ws1.id }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ alreadyActive: boolean }>()
    expect(body.alreadyActive).toBe(true)
    expect(workspaceWatcher.ensureWatching).not.toHaveBeenCalled()
    expect(broadcastMock).not.toHaveBeenCalled()
  })

  it('존재하지 않는 workspaceId → 404 NotFoundError', async () => {
    vi.mocked(workspaceRepository.findById).mockReturnValue(undefined)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/workspace/switch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { workspaceId: 'ws-doesnotexistxx' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
    const body = cap.getJson<{ code: string }>()
    expect(body.code).toBe('NOT_FOUND')
  })

  it('workspaceId 누락 → 400 ValidationError', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/workspace/switch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {}
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
    const body = cap.getJson<{ code: string }>()
    expect(body.code).toBe('VALIDATION')
  })

  it('잘못된 형식의 workspaceId → 400 ValidationError (assertValidId)', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/workspace/switch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { workspaceId: 'a' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})
