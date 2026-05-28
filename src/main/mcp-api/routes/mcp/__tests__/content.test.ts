/**
 * MCP content 라우트 단위 테스트.
 * - GET  /api/mcp/notes/search   (legacy search)
 * - GET  /api/mcp/search         (unified search)
 * - GET  /api/mcp/content/:id    (단건 read)
 * - POST /api/mcp/contents/batch (배치 read, per-id 격리)
 * - POST /api/mcp/content/batch  (배치 manage_content, per-action 격리)
 * - POST /api/mcp/content        (write_content, id 유무로 update/create 분기)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpContentRoutes } from '../content'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({
  broadcastChanged: broadcastMock
}))

vi.mock('../../../../services/note', () => ({
  noteService: {
    search: vi.fn(),
    readContent: vi.fn(),
    writeContent: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../../services/csv-file', () => ({
  csvFileService: {
    readContent: vi.fn(),
    writeContent: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../../services/search', () => ({
  searchService: { search: vi.fn() }
}))
vi.mock('../../../../repositories/note', () => ({
  noteRepository: { findById: vi.fn() }
}))
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
import { csvFileService } from '../../../../services/csv-file'
import { searchService } from '../../../../services/search'
import { noteRepository } from '../../../../repositories/note'
import { csvFileRepository } from '../../../../repositories/csv-file'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type NoteRow = NonNullable<ReturnType<typeof noteRepository.findById>>
type CsvRow = NonNullable<ReturnType<typeof csvFileRepository.findById>>
type NoteCreated = ReturnType<typeof noteService.create>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

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

const CSV_ROW = {
  id: 'csv-abcdefgh',
  workspaceId: WS.id,
  folderId: null,
  title: 'My Sheet',
  relativePath: 'my-sheet.csv',
  description: '',
  preview: '',
  order: 0,
  encoding: 'utf-8',
  columnWidths: null,
  isLocked: false,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as CsvRow

const NOTE_CREATED = {
  id: NOTE_ROW.id,
  title: NOTE_ROW.title,
  relativePath: NOTE_ROW.relativePath
} as unknown as NoteCreated

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
  registerMcpContentRoutes(router)
  return router
}

describe('GET /api/mcp/notes/search (legacy)', () => {
  it('q 가 비어 있으면 service 호출 없이 빈 results', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/notes/search?q=',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(cap.getJson<{ results: unknown[] }>().results).toEqual([])
    expect(noteService.search).not.toHaveBeenCalled()
  })

  it('q 가 있으면 noteService.search 위임', async () => {
    vi.mocked(noteService.search).mockResolvedValue([
      {
        id: 'n1',
        title: 'hit',
        relativePath: 'hit.md',
        folderId: null,
        updatedAt: new Date(),
        preview: 's',
        matchType: 'title'
      }
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/notes/search?q=hello',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(noteService.search).toHaveBeenCalledWith(WS.id, 'hello')
    expect(cap.getJson<{ results: { id: string }[] }>().results[0].id).toBe('n1')
  })
})

describe('GET /api/mcp/search (unified)', () => {
  it('기본 types=[note] + 옵션 파싱', async () => {
    vi.mocked(searchService.search).mockResolvedValue({
      results: [],
      total: 0,
      hasMore: false,
      nextOffset: 0
    } as unknown as Awaited<ReturnType<typeof searchService.search>>)

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/search?q=x&offset=10&limit=20&highlight=true',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(searchService.search).toHaveBeenCalledWith(WS.id, 'x', {
      types: ['note'],
      offset: 10,
      limit: 20,
      highlight: true
    })
  })

  it('types[]=note&types[]=canvas 다중 지정', async () => {
    vi.mocked(searchService.search).mockResolvedValue({
      results: [],
      total: 0,
      hasMore: false,
      nextOffset: 0
    } as unknown as Awaited<ReturnType<typeof searchService.search>>)

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/search?q=x&types[]=note&types[]=canvas',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const callArg = vi.mocked(searchService.search).mock.calls[0]?.[2]
    expect(callArg?.types).toEqual(['note', 'canvas'])
  })

  it('잘못된 type → 400 ValidationError', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/search?q=x&types=bogus',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('GET /api/mcp/content/:id', () => {
  it('note id → note content 반환', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)
    vi.mocked(noteService.readContent).mockReturnValue('# hello')

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/content/${NOTE_ROW.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ type: string; content: string }>()
    expect(body.type).toBe('note')
    expect(body.content).toBe('# hello')
  })

  it('csv id → table content 반환 (encoding/columnWidths 포함)', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(undefined)
    vi.mocked(csvFileRepository.findById).mockReturnValue(CSV_ROW)
    vi.mocked(csvFileService.readContent).mockReturnValue({
      content: 'a,b\n1,2',
      encoding: 'utf-8',
      columnWidths: '[10,20]'
    })

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/content/${CSV_ROW.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ type: string; encoding: string; columnWidths: string }>()
    expect(body.type).toBe('table')
    expect(body.encoding).toBe('utf-8')
    expect(body.columnWidths).toBe('[10,20]')
  })

  it('어떤 repo 에서도 못 찾으면 404 NotFoundError', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(undefined)
    vi.mocked(csvFileRepository.findById).mockReturnValue(undefined)

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/content/missing-1234',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
    expect(cap.getJson<{ code: string }>().code).toBe('NOT_FOUND')
  })
})

describe('POST /api/mcp/contents/batch', () => {
  it('빈 ids 배열 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/contents/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('50개 초과 → 400', async () => {
    const router = setupRouter()
    const ids = Array.from({ length: 51 }, (_, i) => `note-${i.toString().padStart(8, 'a')}`)
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/contents/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('일부 실패해도 results 에 error 채우고 계속', async () => {
    vi.mocked(noteRepository.findById).mockImplementation((id: string) =>
      id === NOTE_ROW.id ? NOTE_ROW : undefined
    )
    vi.mocked(csvFileRepository.findById).mockReturnValue(undefined)
    vi.mocked(noteService.readContent).mockReturnValue('# ok')

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/contents/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids: [NOTE_ROW.id, 'missing-1234'] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { success: boolean }[] }>()
    expect(body.results).toHaveLength(2)
    expect(body.results[0].success).toBe(true)
    expect(body.results[1].success).toBe(false)
  })
})

describe('POST /api/mcp/content/batch (manage)', () => {
  it('빈 actions 배열 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/content/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('note create + update 혼합 → results 반환 + broadcast', async () => {
    vi.mocked(noteService.create).mockReturnValue(NOTE_CREATED)
    vi.mocked(noteService.writeContent).mockReturnValue(undefined)
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/content/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          { action: 'create', type: 'note', title: 'New', content: 'body' },
          { action: 'update', id: NOTE_ROW.id, content: 'updated' }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { success: boolean }[] }>()
    expect(body.results).toHaveLength(2)
    expect(body.results.every((r) => r.success)).toBe(true)
    expect(broadcastMock).toHaveBeenCalledWith(
      'note:changed',
      WS.id,
      expect.any(Array),
      expect.any(Object)
    )
  })

  it('create 시 type 누락 → 해당 entry error, 다른 entry 영향 없음', async () => {
    vi.mocked(noteService.create).mockReturnValue(NOTE_CREATED)
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/content/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          { action: 'create', title: 'No type' },
          { action: 'create', type: 'note', title: 'OK' }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { success: boolean }[] }>()
    expect(body.results[0].success).toBe(false)
    expect(body.results[1].success).toBe(true)
  })
})

describe('POST /api/mcp/content (write_content)', () => {
  it('id 미지정 + note 생성 (created=true)', async () => {
    vi.mocked(noteService.create).mockReturnValue(NOTE_CREATED)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/content',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { type: 'note', title: 'NewNote', content: 'body' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ created: boolean; type: string }>()
    expect(body.created).toBe(true)
    expect(body.type).toBe('note')
    expect(broadcastMock).toHaveBeenCalledWith(
      'note:changed',
      WS.id,
      [NOTE_ROW.relativePath],
      expect.any(Object)
    )
  })

  it('id 지정 → 기존 update (created=false)', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)
    vi.mocked(noteService.writeContent).mockReturnValue(undefined)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/content',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { id: NOTE_ROW.id, content: 'updated' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(cap.getJson<{ created: boolean }>().created).toBe(false)
  })

  it('create 시 type 누락 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/content',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { title: 'No type', content: 'body' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })
})
