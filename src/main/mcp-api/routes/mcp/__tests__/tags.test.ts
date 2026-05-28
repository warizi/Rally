/**
 * MCP tags 라우트 단위 테스트.
 * - GET  /api/mcp/tags                                  (list_tags + search)
 * - GET  /api/mcp/tags/:id/items                        (list_tagged_items + itemTypes 필터, orphan skip)
 * - GET  /api/mcp/tagged/:itemType/:itemId              (list_item_tags + itemType 검증)
 * - POST /api/mcp/tags/batch                            (manage_tags — create/update/delete/attach/detach)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpTagRoutes } from '../tags'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/tag', () => ({
  tagService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../../repositories/tag', () => ({
  tagRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/item-tag', () => ({
  itemTagService: {
    getItemIdsByTag: vi.fn(),
    getTagsByItem: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn()
  }
}))
vi.mock('../../../../repositories/item-tag', () => ({
  itemTagRepository: { detachAllByTag: vi.fn() }
}))
vi.mock('../../../../repositories/note', () => ({
  noteRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/csv-file', () => ({
  csvFileRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/canvas', () => ({
  canvasRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/todo', () => ({
  todoRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/pdf-file', () => ({
  pdfFileRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/image-file', () => ({
  imageFileRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/folder', () => ({
  folderRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { tagService } from '../../../../services/tag'
import { tagRepository } from '../../../../repositories/tag'
import { itemTagService } from '../../../../services/item-tag'
import { itemTagRepository } from '../../../../repositories/item-tag'
import { noteRepository } from '../../../../repositories/note'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type TagRow = NonNullable<ReturnType<typeof tagRepository.findById>>
type NoteRow = NonNullable<ReturnType<typeof noteRepository.findById>>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const TAG: TagRow = {
  id: 'tag-aabbcc12',
  workspaceId: WS.id,
  name: 'Important',
  color: '#ff0000',
  description: 'desc',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as TagRow

const NOTE_ROW = {
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
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as NoteRow

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
  registerMcpTagRoutes(router)
  return router
}

describe('GET /api/mcp/tags', () => {
  it('search 없이 → 전체 tag list 반환', async () => {
    vi.mocked(tagService.getAll).mockReturnValue([TAG])

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/tags', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ tags: { id: string; createdAt: string }[] }>()
    expect(body.tags).toHaveLength(1)
    expect(body.tags[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('search 키워드 → name/description 대소문자 무시 필터', async () => {
    vi.mocked(tagService.getAll).mockReturnValue([
      TAG,
      {
        ...TAG,
        id: 'tag-other001',
        name: 'Other',
        description: 'something else'
      } as unknown as TagRow
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/tags?search=impor',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ tags: { id: string }[] }>()
    expect(body.tags.map((t) => t.id)).toEqual([TAG.id])
  })
})

describe('GET /api/mcp/tags/:id/items', () => {
  it('tagId 유효 + items 매핑 (orphan skip)', async () => {
    vi.mocked(tagRepository.findById).mockReturnValue(TAG)
    vi.mocked(itemTagService.getItemIdsByTag).mockImplementation(
      (_tagId: string, itemType: string) => (itemType === 'note' ? [NOTE_ROW.id, 'orphan-12345'] : [])
    )
    vi.mocked(noteRepository.findById).mockImplementation((id: string) =>
      id === NOTE_ROW.id ? NOTE_ROW : undefined
    )

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/tags/${TAG.id}/items?itemTypes=note`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ items: { id: string; type: string }[] }>()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].id).toBe(NOTE_ROW.id)
  })

  it('잘못된 itemType → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/tags/${TAG.id}/items?itemTypes=bogus`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('다른 워크스페이스의 tag → 404', async () => {
    vi.mocked(tagRepository.findById).mockReturnValue({
      ...TAG,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as TagRow)

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/tags/${TAG.id}/items`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
  })
})

describe('GET /api/mcp/tagged/:itemType/:itemId', () => {
  it('itemType 검증 + tag 목록 반환', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)
    vi.mocked(itemTagService.getTagsByItem).mockReturnValue([TAG])

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/tagged/note/${NOTE_ROW.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ tags: { id: string }[] }>()
    expect(body.tags[0].id).toBe(TAG.id)
  })

  it('잘못된 itemType → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/tagged/bogus/${NOTE_ROW.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('POST /api/mcp/tags/batch', () => {
  it('create_tag → tagService.create 위임 + broadcast', async () => {
    vi.mocked(tagService.create).mockReturnValue(TAG)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/tags/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'create_tag', name: 'New', color: '#000' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { id: string; success: boolean }[] }>()
    expect(body.results[0].success).toBe(true)
    expect(broadcastMock).toHaveBeenCalledWith('tag:changed', WS.id, [])
  })

  it('delete_tag → itemTag 분리 후 tag 삭제', async () => {
    vi.mocked(tagRepository.findById).mockReturnValue(TAG)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/tags/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete_tag', id: TAG.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(itemTagRepository.detachAllByTag).toHaveBeenCalledWith(TAG.id)
    expect(tagService.remove).toHaveBeenCalledWith(TAG.id)
  })

  it('attach → tag + item 검증 후 itemTagService.attach 호출', async () => {
    vi.mocked(tagRepository.findById).mockReturnValue(TAG)
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/tags/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [{ action: 'attach', tagId: TAG.id, itemType: 'note', itemId: NOTE_ROW.id }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(itemTagService.attach).toHaveBeenCalledWith('note', TAG.id, NOTE_ROW.id)
  })

  it('attach 시 itemType 불량 → 400 (전체 batch fail)', async () => {
    vi.mocked(tagRepository.findById).mockReturnValue(TAG)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/tags/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [{ action: 'attach', tagId: TAG.id, itemType: 'bogus', itemId: NOTE_ROW.id }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('빈 actions → 400 (processBatchActions 가드)', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/tags/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})
