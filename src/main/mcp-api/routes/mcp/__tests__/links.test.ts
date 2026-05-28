/**
 * MCP links 라우트 단위 테스트.
 * - POST /api/mcp/links/batch     (link / unlink / list)
 *
 * mutation 동반 batch에서는 entity-link:changed + todo:changed broadcast,
 * list 단독 호출은 read-only로 broadcast 없음.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpLinkRoutes } from '../links'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/entity-link', () => ({
  entityLinkService: {
    link: vi.fn(),
    unlink: vi.fn(),
    getLinked: vi.fn()
  }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { entityLinkService } from '../../../../services/entity-link'
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
  vi.resetAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpLinkRoutes(router)
  return router
}

describe('POST /api/mcp/links/batch', () => {
  it('link → entityLinkService.link 위임 + entity-link:changed + todo:changed broadcast', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/links/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'link',
            sourceType: 'note',
            sourceId: 'n-abcdefgh',
            targetType: 'todo',
            targetId: 't-abcdefgh'
          }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(entityLinkService.link).toHaveBeenCalledWith(
      'note',
      'n-abcdefgh',
      'todo',
      't-abcdefgh',
      WS.id
    )
    expect(broadcastMock).toHaveBeenCalledWith('entity-link:changed', WS.id, [])
    expect(broadcastMock).toHaveBeenCalledWith('todo:changed', WS.id, [])
  })

  it('unlink → entityLinkService.unlink 위임', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/links/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'unlink',
            sourceType: 'note',
            sourceId: 'n-abcdefgh',
            targetType: 'todo',
            targetId: 't-abcdefgh'
          }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(entityLinkService.unlink).toHaveBeenCalled()
  })

  it('list → getLinked 결과 직렬화', async () => {
    vi.mocked(entityLinkService.getLinked).mockReturnValue([
      { entityType: 'note', entityId: 'n-aabbcc12', title: 'Note A', linkedAt: new Date() },
      { entityType: 'csv', entityId: 'c-aabbcc12', title: 'Sheet', linkedAt: new Date() }
    ])

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/links/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [{ action: 'list', entityType: 'todo', entityId: 't-aabbcc12' }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{
      results: { action: string; linkedItems: { type: string; id: string }[] }[]
    }>()
    expect(body.results[0].linkedItems).toHaveLength(2)
  })

  it('list 단독 → mutation broadcast 없음', async () => {
    vi.mocked(entityLinkService.getLinked).mockReturnValue([])

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/links/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [{ action: 'list', entityType: 'todo', entityId: 't-aabbcc12' }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(broadcastMock).not.toHaveBeenCalled()
  })

  it('link 시 sourceId 형식 불량 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/links/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'link',
            sourceType: 'note',
            sourceId: 'x',
            targetType: 'todo',
            targetId: 't-abcdefgh'
          }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('빈 actions → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/links/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })
})
