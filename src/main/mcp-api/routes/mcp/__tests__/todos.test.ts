/**
 * MCP todos 라우트 단위 테스트.
 * - GET  /api/mcp/todos           (list_todos + filter/parentId/linkedTo/dueWithin/priority/search)
 * - POST /api/mcp/todos/batch     (manage_todos: create/update/delete + subtodos + linkItems)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpTodoRoutes } from '../todos'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/todo', () => ({
  todoService: {
    findByWorkspace: vi.fn(),
    findByWorkspaceFiltered: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../../services/entity-link', () => ({
  entityLinkService: {
    getLinkedBatch: vi.fn(),
    getLinkedBatchWithPreview: vi.fn(),
    link: vi.fn(),
    unlink: vi.fn()
  }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { todoService } from '../../../../services/todo'
import type { TodoItem } from '../../../../services/todo'
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

const baseTodo = {
  id: 't1aaaaaaaaaa',
  workspaceId: WS.id,
  parentId: null,
  title: 'todo A',
  description: null,
  status: '진행중',
  priority: 'medium',
  isDone: false,
  dueDate: null,
  startDate: null,
  doneAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  order: 0,
  subOrder: 0,
  kanbanOrder: 0,
  listOrder: 0,
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as TodoItem

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.resetAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(todoService.findByWorkspace).mockReturnValue([])
  vi.mocked(todoService.findByWorkspaceFiltered).mockReturnValue([])
  vi.mocked(entityLinkService.getLinkedBatch).mockReturnValue(new Map())
  vi.mocked(entityLinkService.getLinkedBatchWithPreview).mockReturnValue(new Map())
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpTodoRoutes(router)
  return router
}

describe('GET /api/mcp/todos', () => {
  it('기본 filter=active → todoService.findByWorkspace 위임', async () => {
    vi.mocked(todoService.findByWorkspace).mockReturnValue([baseTodo])

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/todos', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(todoService.findByWorkspace).toHaveBeenCalledWith(WS.id, 'active')
    const body = cap.getJson<{ todos: { id: string; createdAt: string }[] }>()
    expect(body.todos).toHaveLength(1)
    expect(body.todos[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('필터 인자(parentId/dueWithin/priority/search) → findByWorkspaceFiltered 분기', async () => {
    vi.mocked(todoService.findByWorkspaceFiltered).mockReturnValue([baseTodo])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/todos?parentId=null&dueWithin=7&priority=high&search=meet',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(todoService.findByWorkspaceFiltered).toHaveBeenCalled()
    expect(todoService.findByWorkspace).not.toHaveBeenCalled()
  })

  it('잘못된 priority → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/todos?priority=urgent',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('linkedTo[type] 만 있고 id 누락 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/todos?linkedTo[type]=note',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('잘못된 linkedTo type → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/todos?linkedTo[type]=bogus&linkedTo[id]=n-abcdefgh',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('parent/child 매핑 → tree 형태 직렬화', async () => {
    const parent = { ...baseTodo, id: 'p1aaaaaaaaaa', parentId: null }
    const child = { ...baseTodo, id: 'c1aaaaaaaaaa', parentId: 'p1aaaaaaaaaa', title: 'child' }
    vi.mocked(todoService.findByWorkspace).mockReturnValue([parent, child] as unknown as TodoItem[])

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/todos', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ todos: { id: string; children: { id: string }[] }[] }>()
    expect(body.todos).toHaveLength(1)
    expect(body.todos[0].id).toBe('p1aaaaaaaaaa')
    expect(body.todos[0].children).toHaveLength(1)
    expect(body.todos[0].children[0].id).toBe('c1aaaaaaaaaa')
  })
})

describe('POST /api/mcp/todos/batch', () => {
  it('create → todoService.create + broadcast', async () => {
    vi.mocked(todoService.create).mockReturnValue(baseTodo)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/todos/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'create', title: 'new', priority: 'medium' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(todoService.create).toHaveBeenCalled()
    expect(broadcastMock).toHaveBeenCalledWith('todo:changed', WS.id, [])
  })

  it('create 시 subtodos + parentId 동시 지정 → batch fail (2-depth 제약)', async () => {
    vi.mocked(todoService.create).mockReturnValue(baseTodo)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/todos/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'create',
            title: 'parent',
            parentId: 'p1aaaaaaaaaa',
            subtodos: [{ title: 'sub' }]
          }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('update + linkItems → entityLinkService.link 호출', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/todos/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          {
            action: 'update',
            id: baseTodo.id,
            title: 'new title',
            linkItems: [{ type: 'note', id: 'n-abcdefgh' }]
          }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(todoService.update).toHaveBeenCalled()
    expect(entityLinkService.link).toHaveBeenCalledWith(
      'note',
      'n-abcdefgh',
      'todo',
      baseTodo.id,
      WS.id
    )
  })

  it('delete → todoService.remove 호출', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/todos/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: baseTodo.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(todoService.remove).toHaveBeenCalledWith(baseTodo.id)
  })

  it('empty actions → 400 (processBatchActions)', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/todos/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })
})
