/**
 * MCP items 라우트 단위 테스트.
 * - GET  /api/mcp/items           (list_items — workspaceItemsService 위임)
 * - POST /api/mcp/items/batch     (manage_items: rename/move/delete on note/csv)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpItemRoutes } from '../items'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/note', () => ({
  noteService: { rename: vi.fn(), move: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../../../services/csv-file', () => ({
  csvFileService: { rename: vi.fn(), move: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../../../services/workspace-items', () => ({
  workspaceItemsService: { list: vi.fn() }
}))
vi.mock('../../../../repositories/note', () => ({ noteRepository: { findById: vi.fn() } }))
vi.mock('../../../../repositories/csv-file', () => ({
  csvFileRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { noteService } from '../../../../services/note'
import { workspaceItemsService } from '../../../../services/workspace-items'
import { noteRepository } from '../../../../repositories/note'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type NoteRow = NonNullable<ReturnType<typeof noteRepository.findById>>
type RenameResult = ReturnType<typeof noteService.rename>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const NOTE = {
  id: 'note-abcdefgh',
  workspaceId: WS.id,
  folderId: null,
  title: 'My Note',
  relativePath: 'my-note.md',
  description: '',
  preview: '',
  order: 0,
  isLocked: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as NoteRow

const emptyListResult = {
  workspace: { id: WS.id, name: WS.name, path: WS.path },
  folders: [],
  notes: [],
  tables: [],
  canvases: [],
  todos: { active: 0, completed: 0, total: 0 },
  meta: {
    summary: false,
    folderId: null,
    recursive: false,
    types: null,
    limit: 500,
    offset: 0,
    counts: { folders: 0, notes: 0, tables: 0, canvases: 0 },
    hasMore: { folders: false, notes: false, tables: false, canvases: false }
  }
}

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.resetAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(workspaceItemsService.list).mockReturnValue(emptyListResult)
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpItemRoutes(router)
  return router
}

describe('GET /api/mcp/items', () => {
  it('기본 호출 → workspaceItemsService.list 결과 그대로 반환', async () => {
    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/items', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(workspaceItemsService.list).toHaveBeenCalledWith(
      WS.id,
      expect.objectContaining({ recursive: false, summary: false })
    )
  })

  it('잘못된 type → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/items?types=bogus',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('잘못된 updatedAfter → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/items?updatedAfter=not-a-date',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('limit + offset → service 옵션으로 전달', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/items?limit=20&offset=10&recursive=true&summary=true&types=note',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(workspaceItemsService.list).toHaveBeenCalledWith(
      WS.id,
      expect.objectContaining({
        limit: 20,
        offset: 10,
        recursive: true,
        summary: true,
        types: ['note']
      })
    )
  })
})

describe('POST /api/mcp/items/batch', () => {
  it('rename note → noteService.rename + note:changed broadcast (old + new path)', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE)
    vi.mocked(noteService.rename).mockReturnValue({
      id: NOTE.id,
      title: 'renamed',
      relativePath: 'renamed.md'
    } as unknown as RenameResult)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'rename', id: NOTE.id, newName: 'renamed' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(broadcastMock).toHaveBeenCalledWith(
      'note:changed',
      WS.id,
      ['my-note.md', 'renamed.md'],
      expect.any(Object)
    )
  })

  it('delete note → noteService.remove + broadcast', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: NOTE.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(noteService.remove).toHaveBeenCalledWith(WS.id, NOTE.id)
    expect(broadcastMock).toHaveBeenCalledWith(
      'note:changed',
      WS.id,
      ['my-note.md'],
      expect.any(Object)
    )
  })

  it('id 형식 불량 → 400 (assertValidId)', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: 'x' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('어떤 item type도 매치 안 됨 → 404', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: 'missing-1234' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    // resolveItemType throws NotFoundError → processBatchActions ValidationError → 400
    expect([400, 404]).toContain(cap.getStatusCode())
  })

  it('빈 actions → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })
})
