/**
 * MCP trash 라우트 단위 테스트.
 * - GET  /api/mcp/trash                       (list_trash + types/search/offset/limit)
 * - POST /api/mcp/trash/:batchId/restore
 * - POST /api/mcp/trash/:batchId/purge
 * - POST /api/mcp/trash/empty                 (단일 또는 전체 — 전체는 confirm 필수)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpTrashRoutes } from '../trash'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

vi.mock('../../../../services/trash', () => ({
  trashService: {
    list: vi.fn(),
    restore: vi.fn(),
    purge: vi.fn()
  }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { trashService } from '../../../../services/trash'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type TrashListResult = ReturnType<typeof trashService.list>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const BATCH = {
  id: 'batch-aabbcc',
  workspaceId: WS.id,
  deletedAt: new Date('2026-05-28T10:00:00Z'),
  items: [],
  totalItems: 0
}

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.resetAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(trashService.list).mockReturnValue({
    batches: [],
    total: 0,
    hasMore: false,
    nextOffset: 0
  } as unknown as TrashListResult)
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpTrashRoutes(router)
  return router
}

describe('GET /api/mcp/trash', () => {
  it('기본 호출 → trashService.list 결과 직렬화 (deletedAt ISO)', async () => {
    vi.mocked(trashService.list).mockReturnValue({
      batches: [BATCH],
      total: 1,
      hasMore: false,
      nextOffset: 0
    } as unknown as TrashListResult)

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/trash', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{
      batches: { id: string; deletedAt: string }[]
      meta: { total: number; hasMore: boolean }
    }>()
    expect(body.batches[0].deletedAt).toBe('2026-05-28T10:00:00.000Z')
    expect(body.meta.total).toBe(1)
  })

  it('잘못된 type → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/trash?types=bogus',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('잘못된 offset (음수) → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/trash?offset=-1',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('types/search/offset/limit 모두 service 옵션으로 전달', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/trash?types=note,csv&search=hello&offset=10&limit=50',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(trashService.list).toHaveBeenCalledWith(
      WS.id,
      expect.objectContaining({
        types: ['note', 'csv'],
        search: 'hello',
        offset: 10,
        limit: 50
      })
    )
  })
})

describe('POST /api/mcp/trash/:batchId/restore', () => {
  it('정상 → trashService.restore 위임', async () => {
    vi.mocked(trashService.restore).mockReturnValue({
      restored: 5,
      conflicts: []
    } as unknown as ReturnType<typeof trashService.restore>)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: `/api/mcp/trash/${BATCH.id}/restore`,
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: null
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(trashService.restore).toHaveBeenCalledWith(BATCH.id)
    const body = cap.getJson<{ restored: number; conflicts: unknown[] }>()
    expect(body.restored).toBe(5)
    expect(body.conflicts).toEqual([])
  })

  it('batchId 형식 불량 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/trash/x/restore',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: null
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('POST /api/mcp/trash/:batchId/purge', () => {
  it('정상 → trashService.purge + success 응답', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: `/api/mcp/trash/${BATCH.id}/purge`,
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: null
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(trashService.purge).toHaveBeenCalledWith(BATCH.id)
    const body = cap.getJson<{ success: boolean; batchId: string }>()
    expect(body.success).toBe(true)
    expect(body.batchId).toBe(BATCH.id)
  })
})

describe('POST /api/mcp/trash/empty', () => {
  it('batchId 지정 → 단건 purge', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/trash/empty',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { batchId: BATCH.id }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(trashService.purge).toHaveBeenCalledWith(BATCH.id)
    const body = cap.getJson<{ purgedBatchIds: string[] }>()
    expect(body.purgedBatchIds).toEqual([BATCH.id])
  })

  it('batchId 없고 confirm 도 없으면 → 400 (안전장치)', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/trash/empty',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {}
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
    expect(trashService.purge).not.toHaveBeenCalled()
  })

  it('confirm: true → 전체 batch 순회하며 purge', async () => {
    vi.mocked(trashService.list).mockReturnValue({
      batches: [BATCH, { ...BATCH, id: 'batch-bbbbbb' }],
      total: 2,
      hasMore: false,
      nextOffset: 0
    } as unknown as TrashListResult)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/trash/empty',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { confirm: true }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(trashService.purge).toHaveBeenCalledTimes(2)
    const body = cap.getJson<{ purgedBatchIds: string[] }>()
    expect(body.purgedBatchIds).toHaveLength(2)
  })
})
