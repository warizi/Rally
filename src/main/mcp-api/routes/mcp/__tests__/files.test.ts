/**
 * MCP files 라우트 단위 테스트.
 * - GET  /api/mcp/pdfs            (folder scope + search)
 * - POST /api/mcp/pdfs/batch      (manage_files: rename/move/update_meta/delete)
 * - GET  /api/mcp/images
 * - POST /api/mcp/images/batch
 *
 * pdf/image 가 동일 파이프라인 (resolveFolderScope + listFiles + processBatchActions) 을 공유하므로
 * pdf 쪽을 중심으로 검증하고 image 쪽은 happy path 위주로 확인.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpFileRoutes } from '../files'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/pdf-file', () => ({
  pdfFileService: {
    readByWorkspaceFromDb: vi.fn(),
    rename: vi.fn(),
    move: vi.fn(),
    updateMeta: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../../repositories/pdf-file', () => ({
  pdfFileRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/image-file', () => ({
  imageFileService: {
    readByWorkspaceFromDb: vi.fn(),
    rename: vi.fn(),
    move: vi.fn(),
    updateMeta: vi.fn(),
    remove: vi.fn()
  }
}))
vi.mock('../../../../repositories/image-file', () => ({
  imageFileRepository: { findById: vi.fn() }
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

import { pdfFileService } from '../../../../services/pdf-file'
import { pdfFileRepository } from '../../../../repositories/pdf-file'
import { imageFileService } from '../../../../services/image-file'
import { imageFileRepository } from '../../../../repositories/image-file'
import { folderRepository } from '../../../../repositories/folder'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type PdfRow = NonNullable<ReturnType<typeof pdfFileRepository.findById>>
type ImageRow = NonNullable<ReturnType<typeof imageFileRepository.findById>>
type RenameResult = ReturnType<typeof pdfFileService.rename>
type FolderRow = ReturnType<typeof folderRepository.findByWorkspaceId>[number]

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const PDF = {
  id: 'pdf-aabbcc12',
  workspaceId: WS.id,
  folderId: null,
  title: 'doc',
  relativePath: 'doc.pdf',
  description: '',
  preview: '',
  order: 0,
  size: 1024,
  pageCount: 1,
  createdAt: new Date(),
  updatedAt: new Date()
} as unknown as PdfRow

const IMG = {
  id: 'img-aabbcc12',
  workspaceId: WS.id,
  folderId: null,
  title: 'pic',
  relativePath: 'pic.png',
  description: '',
  preview: '',
  order: 0,
  size: 2048,
  mimeType: 'image/png',
  createdAt: new Date(),
  updatedAt: new Date()
} as unknown as ImageRow

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.resetAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(pdfFileService.readByWorkspaceFromDb).mockReturnValue([])
  vi.mocked(imageFileService.readByWorkspaceFromDb).mockReturnValue([])
  vi.mocked(folderRepository.findByWorkspaceId).mockReturnValue([])
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpFileRoutes(router)
  return router
}

describe('GET /api/mcp/pdfs', () => {
  it('기본 호출 → 모든 pdf', async () => {
    vi.mocked(pdfFileService.readByWorkspaceFromDb).mockReturnValue([PDF])

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/pdfs', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ pdfs: { id: string; relativePath: string }[] }>()
    expect(body.pdfs).toHaveLength(1)
    expect(body.pdfs[0].id).toBe(PDF.id)
  })

  it('folderId=null → root 만 (folderId === null filter)', async () => {
    const rootPdf = PDF
    const inFolder = { ...PDF, id: 'pdf-other001', folderId: 'fold-aabbcc12' } as unknown as PdfRow
    vi.mocked(pdfFileService.readByWorkspaceFromDb).mockReturnValue([rootPdf, inFolder])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/pdfs?folderId=null',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ pdfs: { id: string }[] }>()
    expect(body.pdfs.map((p) => p.id)).toEqual([PDF.id])
  })

  it('존재하지 않는 folderId → 400 ValidationError', async () => {
    vi.mocked(folderRepository.findByWorkspaceId).mockReturnValue([])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/pdfs?folderId=fold-missing1',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('search → title 매치 (대소문자 무시)', async () => {
    vi.mocked(pdfFileService.readByWorkspaceFromDb).mockReturnValue([
      PDF,
      { ...PDF, id: 'pdf-other001', title: 'Other' } as unknown as PdfRow
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/pdfs?search=doc',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ pdfs: { id: string }[] }>()
    expect(body.pdfs.map((p) => p.id)).toEqual([PDF.id])
  })

  it('folderId + recursive=true → 후손 모든 폴더 포함', async () => {
    const parent = {
      id: 'fold-parent12',
      workspaceId: WS.id,
      relativePath: 'parent'
    } as unknown as FolderRow
    const child = {
      id: 'fold-child012',
      workspaceId: WS.id,
      relativePath: 'parent/child'
    } as unknown as FolderRow
    vi.mocked(folderRepository.findByWorkspaceId).mockReturnValue([parent, child])
    vi.mocked(pdfFileService.readByWorkspaceFromDb).mockReturnValue([
      { ...PDF, folderId: 'fold-parent12' } as unknown as PdfRow,
      { ...PDF, id: 'pdf-child001', folderId: 'fold-child012' } as unknown as PdfRow,
      { ...PDF, id: 'pdf-outside1', folderId: 'fold-other012' } as unknown as PdfRow
    ])

    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/pdfs?folderId=fold-parent12&recursive=true',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ pdfs: { id: string }[] }>()
    expect(body.pdfs).toHaveLength(2)
  })
})

describe('POST /api/mcp/pdfs/batch', () => {
  it('rename → pdfFileService.rename + pdf:changed broadcast (old + new)', async () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue(PDF)
    vi.mocked(pdfFileService.rename).mockReturnValue({
      id: PDF.id,
      title: 'renamed',
      relativePath: 'renamed.pdf'
    } as unknown as RenameResult)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/pdfs/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'rename', id: PDF.id, newName: 'renamed' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(broadcastMock).toHaveBeenCalledWith(
      'pdf:changed',
      WS.id,
      ['doc.pdf', 'renamed.pdf'],
      expect.any(Object)
    )
  })

  it('update_meta → broadcast 없음 (relativePath 변경 없음)', async () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue(PDF)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/pdfs/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'update_meta', id: PDF.id, description: 'new desc' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(pdfFileService.updateMeta).toHaveBeenCalled()
    expect(broadcastMock).not.toHaveBeenCalled()
  })

  it('delete → broadcast + remove 호출', async () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue(PDF)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/pdfs/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: PDF.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(pdfFileService.remove).toHaveBeenCalledWith(WS.id, PDF.id)
    expect(broadcastMock).toHaveBeenCalledWith(
      'pdf:changed',
      WS.id,
      ['doc.pdf'],
      expect.any(Object)
    )
  })

  it('다른 워크스페이스 pdf → 404 (전체 batch fail)', async () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue({
      ...PDF,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as PdfRow)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/pdfs/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: PDF.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
    expect(pdfFileService.remove).not.toHaveBeenCalled()
  })
})

describe('GET /api/mcp/images', () => {
  it('기본 호출 → 모든 image', async () => {
    vi.mocked(imageFileService.readByWorkspaceFromDb).mockReturnValue([IMG])

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/images', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ images: { id: string }[] }>()
    expect(body.images[0].id).toBe(IMG.id)
  })
})

describe('POST /api/mcp/images/batch', () => {
  it('rename → imageFileService.rename + image:changed broadcast', async () => {
    vi.mocked(imageFileRepository.findById).mockReturnValue(IMG)
    vi.mocked(imageFileService.rename).mockReturnValue({
      id: IMG.id,
      title: 'pic2',
      relativePath: 'pic2.png'
    } as unknown as RenameResult)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/images/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'rename', id: IMG.id, newName: 'pic2' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(broadcastMock).toHaveBeenCalledWith(
      'image:changed',
      WS.id,
      ['pic.png', 'pic2.png'],
      expect.any(Object)
    )
  })
})
