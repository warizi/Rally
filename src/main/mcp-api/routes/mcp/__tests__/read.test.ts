/**
 * MCP read 라우트 단위 테스트.
 * - POST /api/mcp/read              (note/csv/canvas/template type 자동 감지 + per-id 격리)
 * - POST /api/mcp/note-images/read  (노트 내 .images/ base64 단건 fetch)
 *
 * pdf/image 본문 추출은 binary/Promise 의존성이 커서 별도 service 단위 테스트로 다루고,
 * 여기서는 type dispatch + 검증/격리 + workspace 소유권 가드만 검증한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpReadRoutes } from '../read'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

vi.mock('../../../../repositories/note', () => ({ noteRepository: { findById: vi.fn() } }))
vi.mock('../../../../repositories/csv-file', () => ({
  csvFileRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/canvas', () => ({
  canvasRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/pdf-file', () => ({
  pdfFileRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/image-file', () => ({
  imageFileRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/template', () => ({
  templateRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/note', () => ({
  noteService: { readContent: vi.fn() }
}))
vi.mock('../../../../services/csv-file', () => ({
  csvFileService: { readContent: vi.fn() }
}))
vi.mock('../../../../services/canvas-node', () => ({
  canvasNodeService: { findByCanvas: vi.fn() }
}))
vi.mock('../../../../services/canvas-edge', () => ({
  canvasEdgeService: { findByCanvas: vi.fn() }
}))
vi.mock('../../../../services/image-file', () => ({
  imageFileService: { readBase64Content: vi.fn() }
}))
vi.mock('../../../../services/note-image', () => ({
  noteImageService: {
    extractImagePaths: vi.fn(),
    statImage: vi.fn(),
    readImageAsBase64: vi.fn()
  }
}))
vi.mock('../../../../services/pdf-file', () => ({
  pdfFileService: { readTextContent: vi.fn(), readPageImages: vi.fn() }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { noteRepository } from '../../../../repositories/note'
import { csvFileRepository } from '../../../../repositories/csv-file'
import { canvasRepository } from '../../../../repositories/canvas'
import { templateRepository } from '../../../../repositories/template'
import { noteService } from '../../../../services/note'
import { csvFileService } from '../../../../services/csv-file'
import { canvasNodeService } from '../../../../services/canvas-node'
import { canvasEdgeService } from '../../../../services/canvas-edge'
import { noteImageService } from '../../../../services/note-image'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type NoteRow = NonNullable<ReturnType<typeof noteRepository.findById>>
type CsvRow = NonNullable<ReturnType<typeof csvFileRepository.findById>>
type CanvasRow = NonNullable<ReturnType<typeof canvasRepository.findById>>
type TemplateRow = NonNullable<ReturnType<typeof templateRepository.findById>>

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
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as NoteRow

const CSV_ROW = {
  id: 'csv-abcdefgh',
  workspaceId: WS.id,
  folderId: null,
  title: 'sheet',
  relativePath: 'sheet.csv',
  description: '',
  preview: '',
  order: 0,
  encoding: 'utf-8',
  columnWidths: null,
  isLocked: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'user',
  createdById: null,
  updatedBy: 'user',
  updatedById: null
} as unknown as CsvRow

const CANVAS_ROW = {
  id: 'canv-abcdefg1',
  workspaceId: WS.id,
  title: 'C',
  description: 'd',
  isLocked: false,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z')
} as unknown as CanvasRow

const TEMPLATE_ROW = {
  id: 'tmpl-abcdefg1',
  workspaceId: WS.id,
  title: 't',
  type: 'note',
  jsonData: '{}',
  createdAt: new Date('2026-01-01T00:00:00Z')
} as unknown as TemplateRow

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.clearAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(noteRepository.findById).mockReturnValue(undefined)
  vi.mocked(csvFileRepository.findById).mockReturnValue(undefined)
  vi.mocked(canvasRepository.findById).mockReturnValue(undefined)
  vi.mocked(templateRepository.findById).mockReturnValue(undefined)
  vi.mocked(noteImageService.extractImagePaths).mockReturnValue([])
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpReadRoutes(router)
  return router
}

describe('POST /api/mcp/read', () => {
  it('empty ids → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/read',
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
      url: '/api/mcp/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('note id → note entry + embeddedImages 메타', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)
    vi.mocked(noteService.readContent).mockReturnValue('# hello\n![](/.images/a.png)')
    vi.mocked(noteImageService.extractImagePaths).mockReturnValue(['/.images/a.png'])
    vi.mocked(noteImageService.statImage).mockReturnValue({ size: 123, mimeType: 'image/png' })

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids: [NOTE_ROW.id] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{
      results: { success: boolean; type: string; embeddedImages?: { size: number }[] }[]
    }>()
    expect(body.results[0].success).toBe(true)
    expect(body.results[0].type).toBe('note')
    expect(body.results[0].embeddedImages).toEqual([
      { src: '/.images/a.png', size: 123, mimeType: 'image/png' }
    ])
  })

  it('csv id → csv entry (encoding + columnWidths)', async () => {
    vi.mocked(csvFileRepository.findById).mockReturnValue(CSV_ROW)
    vi.mocked(csvFileService.readContent).mockReturnValue({
      content: 'a,b\n1,2',
      encoding: 'utf-8',
      columnWidths: null
    })

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids: [CSV_ROW.id] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { type: string; encoding: string }[] }>()
    expect(body.results[0].type).toBe('csv')
    expect(body.results[0].encoding).toBe('utf-8')
  })

  it('canvas id → canvas entry + nodes/edges', async () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(CANVAS_ROW)
    vi.mocked(canvasNodeService.findByCanvas).mockReturnValue([])
    vi.mocked(canvasEdgeService.findByCanvas).mockReturnValue([])

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids: [CANVAS_ROW.id] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { type: string; updatedAt: string }[] }>()
    expect(body.results[0].type).toBe('canvas')
    expect(body.results[0].updatedAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('template id → template entry', async () => {
    vi.mocked(templateRepository.findById).mockReturnValue(TEMPLATE_ROW)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids: [TEMPLATE_ROW.id] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { type: string; templateType: string }[] }>()
    expect(body.results[0].type).toBe('template')
    expect(body.results[0].templateType).toBe('note')
  })

  it('어떤 type 에서도 못 찾으면 entry error (per-id 격리, 다른 id 영향 X)', async () => {
    vi.mocked(noteRepository.findById).mockImplementation((id: string) =>
      id === NOTE_ROW.id ? NOTE_ROW : undefined
    )
    vi.mocked(noteService.readContent).mockReturnValue('# ok')

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids: [NOTE_ROW.id, 'missing-1234'] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { success: boolean }[] }>()
    expect(body.results[0].success).toBe(true)
    expect(body.results[1].success).toBe(false)
  })

  it('다른 워크스페이스의 note → entry error (cross-workspace 차단)', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue({
      ...NOTE_ROW,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as NoteRow)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { ids: [NOTE_ROW.id] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { success: boolean }[] }>()
    expect(body.results[0].success).toBe(false)
  })
})

describe('POST /api/mcp/note-images/read', () => {
  it('noteId 누락 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/note-images/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { src: '/.images/a.png' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('src 누락 → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/note-images/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { noteId: NOTE_ROW.id }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })

  it('정상 → noteImageService.readImageAsBase64 위임', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)
    vi.mocked(noteImageService.readImageAsBase64).mockReturnValue({
      data: 'BASE64',
      mimeType: 'image/png',
      size: 123,
      truncated: false
    })

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/note-images/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { noteId: NOTE_ROW.id, src: '/.images/a.png' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ src: string; data: string }>()
    expect(body.src).toBe('/.images/a.png')
    expect(body.data).toBe('BASE64')
  })

  it('다른 워크스페이스의 noteId → 404', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue({
      ...NOTE_ROW,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as NoteRow)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/note-images/read',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { noteId: NOTE_ROW.id, src: '/.images/a.png' }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
  })
})
