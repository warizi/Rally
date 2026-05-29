/**
 * MCP browse 라우트 단위 테스트.
 * - GET /api/mcp/browse
 *
 * list_items + list_files + list_tagged_items + list_tags 통합. type discriminator 와
 * cross-cutting 필터(tagId, linkedTo)로 단일 도구가 7종 entity 를 다룬다.
 * 본 테스트는 type 디스패치 + 필터 파싱 + restrict map(AND 교집합)·페이지네이션을 다룬다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpBrowseRoutes } from '../browse'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

vi.mock('../../../../services/workspace-items', () => ({
  workspaceItemsService: { list: vi.fn() }
}))
vi.mock('../../../../services/pdf-file', () => ({
  pdfFileService: { readByWorkspaceFromDb: vi.fn() }
}))
vi.mock('../../../../services/image-file', () => ({
  imageFileService: { readByWorkspaceFromDb: vi.fn() }
}))
vi.mock('../../../../services/tag', () => ({
  tagService: { getAll: vi.fn() }
}))
vi.mock('../../../../services/item-tag', () => ({
  itemTagService: { getItemIdsByTag: vi.fn() }
}))
vi.mock('../../../../services/entity-link', () => ({
  entityLinkService: { getLinked: vi.fn() }
}))
vi.mock('../../../../repositories/folder', () => ({
  folderRepository: { findByWorkspaceId: vi.fn() }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { workspaceItemsService } from '../../../../services/workspace-items'
import { pdfFileService } from '../../../../services/pdf-file'
import { imageFileService } from '../../../../services/image-file'
import { tagService } from '../../../../services/tag'
import { itemTagService } from '../../../../services/item-tag'
import { entityLinkService } from '../../../../services/entity-link'
import { folderRepository } from '../../../../repositories/folder'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

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

function noteEntry(partial: { id: string; title: string; relativePath?: string }): {
  id: string
  title: string
  folderId: string | null
  updatedAt: string
  relativePath?: string
  preview?: string | null
  folderPath?: string | null
} {
  return {
    id: partial.id,
    title: partial.title,
    folderId: null,
    updatedAt: '2026-01-02T00:00:00.000Z',
    relativePath: partial.relativePath ?? `${partial.title}.md`,
    preview: ''
  }
}

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.clearAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(workspaceItemsService.list).mockReturnValue(emptyListResult)
  vi.mocked(pdfFileService.readByWorkspaceFromDb).mockReturnValue([])
  vi.mocked(imageFileService.readByWorkspaceFromDb).mockReturnValue([])
  vi.mocked(tagService.getAll).mockReturnValue([])
  vi.mocked(folderRepository.findByWorkspaceId).mockReturnValue([])
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpBrowseRoutes(router)
  return router
}

describe('GET /api/mcp/browse — types & meta', () => {
  it('types 미지정 → 7종 모두 응답 키에 포함 + workspace meta', async () => {
    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/browse', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<Record<string, unknown>>()
    expect(body.workspace).toEqual({ id: WS.id, name: WS.name, path: WS.path })
    expect(body.folders).toBeDefined()
    expect(body.notes).toBeDefined()
    expect(body.tables).toBeDefined()
    expect(body.canvases).toBeDefined()
    expect(body.pdfs).toBeDefined()
    expect(body.images).toBeDefined()
    expect(body.tags).toBeDefined()
  })

  it('types=note,canvas → 지정한 키만 응답 + 그 외 키는 없음', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?types=note,canvas',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<Record<string, unknown>>()
    expect(body.notes).toBeDefined()
    expect(body.canvases).toBeDefined()
    expect(body.folders).toBeUndefined()
    expect(body.tags).toBeUndefined()
    expect(body.pdfs).toBeUndefined()
  })

  it('잘못된 type → 400 VALIDATION', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?types=bogus',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('GET /api/mcp/browse — pagination & validation', () => {
  it('limit 1000 초과 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?limit=2000',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('limit < 1 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?limit=0',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('updatedAfter 형식 불량 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?updatedAfter=invalid',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('limit + offset → workspaceItemsService.list 에 그대로 전달', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?types=note&limit=20&offset=5',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(workspaceItemsService.list).toHaveBeenCalledWith(
      WS.id,
      expect.objectContaining({ limit: 20, offset: 5, types: ['note'] })
    )
  })
})

describe('GET /api/mcp/browse — linkedTo / tagId restrict', () => {
  it('linkedTo 만 → 해당 ids 만 통과', async () => {
    vi.mocked(entityLinkService.getLinked).mockReturnValue([
      { entityType: 'note', entityId: 'n-keep001234', title: '', linkedAt: new Date() },
      { entityType: 'canvas', entityId: 'c-keep001234', title: '', linkedAt: new Date() }
    ])
    vi.mocked(workspaceItemsService.list).mockReturnValue({
      ...emptyListResult,
      notes: [
        noteEntry({ id: 'n-keep001234', title: 'keep' }),
        noteEntry({ id: 'n-drop001234', title: 'drop' })
      ]
    })

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?types=note&linkedTo[type]=todo&linkedTo[id]=td-abcdef12',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ notes: { id: string }[] }>()
    expect(body.notes.map((n) => n.id)).toEqual(['n-keep001234'])
  })

  it('linkedTo type 만 있고 id 누락 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?linkedTo[type]=todo',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('잘못된 linkedTo type → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?linkedTo[type]=bogus&linkedTo[id]=td-abcdef12',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('tagId + linkedTo → AND 교집합', async () => {
    vi.mocked(itemTagService.getItemIdsByTag).mockReturnValue(['n-a000000000', 'n-b000000000'])
    vi.mocked(entityLinkService.getLinked).mockReturnValue([
      { entityType: 'note', entityId: 'n-b000000000', title: '', linkedAt: new Date() },
      { entityType: 'note', entityId: 'n-c000000000', title: '', linkedAt: new Date() }
    ])
    vi.mocked(workspaceItemsService.list).mockReturnValue({
      ...emptyListResult,
      notes: [
        noteEntry({ id: 'n-a000000000', title: 'A' }),
        noteEntry({ id: 'n-b000000000', title: 'B' }),
        noteEntry({ id: 'n-c000000000', title: 'C' })
      ]
    })

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?types=note&tagId=tag-aabbcc12&linkedTo[type]=todo&linkedTo[id]=td-abcdef12',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ notes: { id: string }[] }>()
    expect(body.notes.map((n) => n.id)).toEqual(['n-b000000000'])
  })
})

describe('GET /api/mcp/browse — search & tag list', () => {
  it('search → 제목 매치만 통과 (대소문자 무시)', async () => {
    vi.mocked(workspaceItemsService.list).mockReturnValue({
      ...emptyListResult,
      notes: [
        noteEntry({ id: 'n-hello00000', title: 'Hello World', relativePath: 'hello.md' }),
        noteEntry({ id: 'n-other00000', title: 'Other', relativePath: 'other.md' })
      ]
    })

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?types=note&search=hello',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ notes: { id: string }[] }>()
    expect(body.notes.map((n) => n.id)).toEqual(['n-hello00000'])
  })

  it('types=tag → tagService.getAll 결과를 직렬화 + 페이지네이션', async () => {
    vi.mocked(tagService.getAll).mockReturnValue([
      {
        id: 'tag-aabbcc12',
        workspaceId: WS.id,
        name: 'Important',
        color: '#ff0000',
        description: 'desc',
        createdAt: new Date('2026-01-01T00:00:00Z')
      }
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/browse?types=tag',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ tags: { id: string; createdAt: string }[] }>()
    expect(body.tags).toHaveLength(1)
    expect(body.tags[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})
