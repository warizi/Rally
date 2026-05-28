/**
 * MCP manage-items 라우트 단위 테스트.
 * - POST /api/mcp/manage-items/batch (rename/move/delete/create_folder/update_meta)
 *
 * id 자동 type detection (note/csv/canvas/pdf/image/folder) + per-action 에러 격리 +
 * type별 broadcast 채널 분기를 검증.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpManageItemsRoutes } from '../manage-items'
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
vi.mock('../../../../services/canvas', () => ({
  canvasService: { update: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../../../services/pdf-file', () => ({
  pdfFileService: { rename: vi.fn(), move: vi.fn(), remove: vi.fn(), updateMeta: vi.fn() }
}))
vi.mock('../../../../services/image-file', () => ({
  imageFileService: { rename: vi.fn(), move: vi.fn(), remove: vi.fn(), updateMeta: vi.fn() }
}))
vi.mock('../../../../services/folder', () => ({
  folderService: { create: vi.fn(), rename: vi.fn(), move: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../../../repositories/note', () => ({ noteRepository: { findById: vi.fn() } }))
vi.mock('../../../../repositories/csv-file', () => ({ csvFileRepository: { findById: vi.fn() } }))
vi.mock('../../../../repositories/canvas', () => ({ canvasRepository: { findById: vi.fn() } }))
vi.mock('../../../../repositories/pdf-file', () => ({ pdfFileRepository: { findById: vi.fn() } }))
vi.mock('../../../../repositories/image-file', () => ({
  imageFileRepository: { findById: vi.fn() }
}))
vi.mock('../../../../repositories/folder', () => ({ folderRepository: { findById: vi.fn() } }))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { noteService } from '../../../../services/note'
import { pdfFileService } from '../../../../services/pdf-file'
import { folderService } from '../../../../services/folder'
import { noteRepository } from '../../../../repositories/note'
import { canvasRepository } from '../../../../repositories/canvas'
import { pdfFileRepository } from '../../../../repositories/pdf-file'
import { folderRepository } from '../../../../repositories/folder'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type NoteRow = NonNullable<ReturnType<typeof noteRepository.findById>>
type CanvasRow = NonNullable<ReturnType<typeof canvasRepository.findById>>
type PdfRow = NonNullable<ReturnType<typeof pdfFileRepository.findById>>
type FolderRow = NonNullable<ReturnType<typeof folderRepository.findById>>
type RenameResult = ReturnType<typeof noteService.rename>
type FolderCreateResult = ReturnType<typeof folderService.create>

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

const CANVAS_ROW = {
  id: 'canv-abcdefg1',
  workspaceId: WS.id,
  title: 'C',
  description: '',
  isLocked: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
} as unknown as CanvasRow

const PDF_ROW = {
  id: 'pdf-abcdefgh',
  workspaceId: WS.id,
  folderId: null,
  title: 'doc',
  relativePath: 'doc.pdf',
  description: '',
  size: 1024,
  pageCount: 1,
  createdAt: new Date(),
  updatedAt: new Date()
} as unknown as PdfRow

const FOLDER_ROW = {
  id: 'fold-abcdefg1',
  workspaceId: WS.id,
  parentId: null,
  name: 'docs',
  relativePath: 'docs',
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date()
} as unknown as FolderRow

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  // detectType()가 7개 repository 를 순차 검사하므로, 이전 테스트의 mockReturnValue 가
  // 다음 테스트로 누수되면 잘못된 type 으로 분기됨. resetAllMocks 로 implementation 까지 초기화.
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
  registerMcpManageItemsRoutes(router)
  return router
}

describe('POST /api/mcp/manage-items/batch', () => {
  it('empty actions → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/manage-items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
  })

  it('create_folder → folderService.create + folder:changed broadcast', async () => {
    vi.mocked(folderService.create).mockReturnValue(FOLDER_ROW as unknown as FolderCreateResult)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/manage-items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'create_folder', name: 'docs' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(folderService.create).toHaveBeenCalledWith(WS.id, null, 'docs', expect.any(Object))
    expect(broadcastMock).toHaveBeenCalledWith('folder:changed', WS.id, [], expect.any(Object))
  })

  it('rename note → noteService.rename + note:changed broadcast (old + new path)', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)
    vi.mocked(noteService.rename).mockReturnValue({
      id: NOTE_ROW.id,
      title: 'Renamed',
      relativePath: 'renamed.md'
    } as unknown as RenameResult)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/manage-items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'rename', id: NOTE_ROW.id, newName: 'Renamed' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { type: string; success: boolean }[] }>()
    expect(body.results[0].type).toBe('note')
    expect(broadcastMock).toHaveBeenCalledWith(
      'note:changed',
      WS.id,
      ['my-note.md', 'renamed.md'],
      expect.any(Object)
    )
  })

  it('canvas move → ValidationError (canvas는 folder 계층 없음)', async () => {
    vi.mocked(canvasRepository.findById).mockReturnValue(CANVAS_ROW)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/manage-items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'move', id: CANVAS_ROW.id, targetFolderId: 'fold-abcdefg1' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{
      results: { success: boolean; error?: { code: string } }[]
    }>()
    expect(body.results[0].success).toBe(false)
    expect(body.results[0].error?.code).toBe('ValidationError')
  })

  it('update_meta on note → ValidationError (pdf/image 만 허용)', async () => {
    vi.mocked(noteRepository.findById).mockReturnValue(NOTE_ROW)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/manage-items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'update_meta', id: NOTE_ROW.id, description: 'x' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { success: boolean }[] }>()
    expect(body.results[0].success).toBe(false)
  })

  it('update_meta on pdf → pdfFileService.updateMeta', async () => {
    vi.mocked(pdfFileRepository.findById).mockReturnValue(PDF_ROW)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/manage-items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'update_meta', id: PDF_ROW.id, description: 'new desc' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(pdfFileService.updateMeta).toHaveBeenCalledWith(
      WS.id,
      PDF_ROW.id,
      { description: 'new desc' },
      expect.any(Object)
    )
  })

  it('delete note + delete folder mixed → 두 채널 모두 broadcast', async () => {
    vi.mocked(noteRepository.findById).mockImplementation((id: string) =>
      id === NOTE_ROW.id ? NOTE_ROW : undefined
    )
    vi.mocked(folderRepository.findById).mockImplementation((id: string) =>
      id === FOLDER_ROW.id ? FOLDER_ROW : undefined
    )

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/manage-items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          { action: 'delete', id: NOTE_ROW.id },
          { action: 'delete', id: FOLDER_ROW.id }
        ]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(noteService.remove).toHaveBeenCalledWith(WS.id, NOTE_ROW.id)
    expect(folderService.remove).toHaveBeenCalledWith(WS.id, FOLDER_ROW.id)
    expect(broadcastMock).toHaveBeenCalledWith('note:changed', WS.id, ['my-note.md'], expect.any(Object))
    expect(broadcastMock).toHaveBeenCalledWith('folder:changed', WS.id, [], expect.any(Object))
  })

  it('id가 어떤 type에도 매치 안 됨 → 해당 entry error 반환, 다른 entry 영향 없음', async () => {
    vi.mocked(noteRepository.findById).mockImplementation((id: string) =>
      id === NOTE_ROW.id ? NOTE_ROW : undefined
    )

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/manage-items/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [
          { action: 'delete', id: 'missing-1234' },
          { action: 'rename', id: NOTE_ROW.id, newName: 'Renamed' }
        ]
      }
    })
    const cap = makeRes()
    vi.mocked(noteService.rename).mockReturnValue({
      id: NOTE_ROW.id,
      title: 'Renamed',
      relativePath: 'renamed.md'
    } as unknown as RenameResult)
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ results: { success: boolean; error?: { code: string } }[] }>()
    expect(body.results[0].success).toBe(false)
    expect(body.results[0].error?.code).toBe('NotFoundError')
    expect(body.results[1].success).toBe(true)
  })
})
