/**
 * MCP canvases 라우트 단위 테스트.
 * - GET  /api/mcp/canvases/:canvasId        (read_canvas + 워크스페이스 가드)
 * - POST /api/mcp/canvases                  (create_canvas + nodes/edges 트랜잭션)
 * - POST /api/mcp/canvases/:canvasId/edit   (update/add_node/remove_node/add_edge/remove_edge)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpCanvasRoutes } from '../canvases'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/canvas', () => ({
  canvasService: { findById: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../../../services/canvas-node', () => ({
  canvasNodeService: { findByCanvas: vi.fn(), create: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../../../services/canvas-edge', () => ({
  canvasEdgeService: { findByCanvas: vi.fn(), create: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../../../services/canvas-group', () => ({
  canvasGroupService: {
    findByCanvas: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { canvasService } from '../../../../services/canvas'
import { canvasNodeService } from '../../../../services/canvas-node'
import { canvasEdgeService } from '../../../../services/canvas-edge'
import { canvasGroupService } from '../../../../services/canvas-group'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type Canvas = NonNullable<ReturnType<typeof canvasService.findById>>
type CanvasNode = ReturnType<typeof canvasNodeService.create>
type CanvasEdge = ReturnType<typeof canvasEdgeService.create>
type CanvasGroup = ReturnType<typeof canvasGroupService.create>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const CANVAS = {
  id: 'canv-abcdefg1',
  workspaceId: WS.id,
  title: 'Mind map',
  description: '',
  isLocked: false,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z')
} as unknown as Canvas

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.resetAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(canvasNodeService.findByCanvas).mockReturnValue([])
  vi.mocked(canvasEdgeService.findByCanvas).mockReturnValue([])
  vi.mocked(canvasGroupService.findByCanvas).mockReturnValue([])
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpCanvasRoutes(router)
  return router
}

describe('GET /api/mcp/canvases/:canvasId', () => {
  it('정상 → canvas + nodes + edges 직렬화', async () => {
    vi.mocked(canvasService.findById).mockReturnValue(CANVAS)

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/canvases/${CANVAS.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ canvas: { id: string; updatedAt: string } }>()
    expect(body.canvas.id).toBe(CANVAS.id)
    expect(body.canvas.updatedAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('다른 워크스페이스 → 404', async () => {
    vi.mocked(canvasService.findById).mockReturnValue({
      ...CANVAS,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as Canvas)

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/canvases/${CANVAS.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
  })
})

describe('POST /api/mcp/canvases', () => {
  it('빈 nodes 와 edges 만 지정 → 400 (edges require nodes)', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/canvases',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        title: 'X',
        edges: [{ fromNodeIndex: 0, toNodeIndex: 1 }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('정상 (title 만) → canvas 생성 + broadcast', async () => {
    vi.mocked(canvasService.create).mockReturnValue(CANVAS)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/canvases',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { title: 'Mind map' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(canvasService.create).toHaveBeenCalled()
    expect(broadcastMock).toHaveBeenCalledWith('canvas:changed', WS.id, [])
  })

  it('nodes + edges 동시 생성 → tempIdMap 으로 fromNode/toNode 해석', async () => {
    vi.mocked(canvasService.create).mockReturnValue(CANVAS)
    vi.mocked(canvasNodeService.create)
      .mockReturnValueOnce({ id: 'n-aa', type: 'text', x: 0, y: 0 } as unknown as CanvasNode)
      .mockReturnValueOnce({ id: 'n-bb', type: 'text', x: 100, y: 100 } as unknown as CanvasNode)
    vi.mocked(canvasEdgeService.create).mockReturnValue({ id: 'e-aa' } as unknown as CanvasEdge)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/canvases',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        title: 'with edges',
        nodes: [
          { type: 'text', x: 0, y: 0, width: 100, height: 50 },
          { type: 'text', x: 100, y: 100, width: 100, height: 50 }
        ],
        edges: [{ fromNodeIndex: 0, toNodeIndex: 1 }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(canvasNodeService.create).toHaveBeenCalledTimes(2)
    expect(canvasEdgeService.create).toHaveBeenCalledTimes(1)
  })

  it('edge.fromNodeIndex 가 nodes 범위 밖 → 트랜잭션 fail (400)', async () => {
    vi.mocked(canvasService.create).mockReturnValue(CANVAS)
    vi.mocked(canvasNodeService.create).mockReturnValue({
      id: 'n-aa',
      type: 'text',
      x: 0,
      y: 0
    } as unknown as CanvasNode)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/canvases',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        title: 'bad edge',
        nodes: [{ type: 'text', x: 0, y: 0, width: 100, height: 50 }],
        edges: [{ fromNodeIndex: 9, toNodeIndex: 0 }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('POST /api/mcp/canvases/:canvasId/edit', () => {
  it('단독 delete → canvasService.remove + broadcast', async () => {
    vi.mocked(canvasService.findById).mockReturnValue(CANVAS)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: `/api/mcp/canvases/${CANVAS.id}/edit`,
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(canvasService.remove).toHaveBeenCalledWith(CANVAS.id)
    expect(broadcastMock).toHaveBeenCalledWith('canvas:changed', WS.id, [])
  })

  it('delete + 다른 action 조합 → 400 (단독 강제)', async () => {
    vi.mocked(canvasService.findById).mockReturnValue(CANVAS)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: `/api/mcp/canvases/${CANVAS.id}/edit`,
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete' }, { action: 'update', title: 'x' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('add_node + add_edge (tempId 활용) → 트랜잭션 내 매핑', async () => {
    vi.mocked(canvasService.findById).mockReturnValue(CANVAS)
    vi.mocked(canvasNodeService.create).mockReturnValue({
      id: 'n-newaa',
      type: 'text',
      x: 0,
      y: 0
    } as unknown as CanvasNode)
    vi.mocked(canvasEdgeService.create).mockReturnValue({ id: 'e-newaa' } as unknown as CanvasEdge)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: `/api/mcp/canvases/${CANVAS.id}/edit`,
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          { action: 'add_node', tempId: 'tmp-1', type: 'text', x: 0, y: 0, width: 100, height: 50 },
          { action: 'add_edge', fromNode: 'tmp-1', toNode: 'n-existing0' }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    // tempId 'tmp-1' 가 새로 만든 node id 로 해석돼서 edge 생성 인자에 들어가야 함
    expect(canvasEdgeService.create).toHaveBeenCalledWith(
      CANVAS.id,
      expect.objectContaining({ fromNode: 'n-newaa', toNode: 'n-existing0' })
    )
  })

  it('add_group + add_node (groupTempId 활용) → node.groupId 로 해석', async () => {
    vi.mocked(canvasService.findById).mockReturnValue(CANVAS)
    vi.mocked(canvasGroupService.create).mockReturnValue({
      id: 'g-newaa'
    } as unknown as CanvasGroup)
    vi.mocked(canvasNodeService.create).mockReturnValue({
      id: 'n-newaa',
      type: 'text',
      x: 0,
      y: 0
    } as unknown as CanvasNode)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: `/api/mcp/canvases/${CANVAS.id}/edit`,
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'add_group',
            groupTempId: 'grp-1',
            label: '그룹',
            x: 0,
            y: 0,
            width: 300,
            height: 200
          },
          { action: 'add_node', type: 'text', x: 10, y: 10, groupId: 'grp-1' }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(canvasGroupService.create).toHaveBeenCalledTimes(1)
    // groupTempId 'grp-1' 가 새 group id 로 해석돼 node.groupId 로 들어가야 함
    expect(canvasNodeService.create).toHaveBeenCalledWith(
      CANVAS.id,
      expect.objectContaining({ groupId: 'g-newaa' })
    )
  })

  it('remove_group → canvasGroupService.remove 호출', async () => {
    vi.mocked(canvasService.findById).mockReturnValue(CANVAS)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: `/api/mcp/canvases/${CANVAS.id}/edit`,
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'remove_group', groupId: 'g-x' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(canvasGroupService.remove).toHaveBeenCalledWith('g-x')
  })

  it('빈 actions → 400', async () => {
    vi.mocked(canvasService.findById).mockReturnValue(CANVAS)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: `/api/mcp/canvases/${CANVAS.id}/edit`,
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('다른 워크스페이스 canvas → 404', async () => {
    vi.mocked(canvasService.findById).mockReturnValue({
      ...CANVAS,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as Canvas)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: `/api/mcp/canvases/${CANVAS.id}/edit`,
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'update', title: 'x' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
  })
})
