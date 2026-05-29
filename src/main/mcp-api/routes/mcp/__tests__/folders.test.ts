/**
 * MCP folders 라우트 단위 테스트.
 * - POST /api/mcp/folders/batch  (manage_folders: create/rename/move/delete)
 *
 * 핵심: preflight 단계 — 실행 전 모든 id 유효성을 한 번 더 검증해 부분 commit 방지.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpFolderRoutes } from '../folders'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../repositories/folder', () => ({
  folderRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/folder', () => ({
  folderService: { create: vi.fn(), rename: vi.fn(), move: vi.fn(), remove: vi.fn() }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { folderRepository } from '../../../../repositories/folder'
import { folderService } from '../../../../services/folder'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type FolderRow = NonNullable<ReturnType<typeof folderRepository.findById>>
type FolderCreateResult = ReturnType<typeof folderService.create>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const FOLDER = {
  id: 'fold-aabbcc12',
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
  registerMcpFolderRoutes(router)
  return router
}

describe('POST /api/mcp/folders/batch', () => {
  it('create (root) → folderService.create + folder:changed broadcast', async () => {
    vi.mocked(folderService.create).mockReturnValue(FOLDER as unknown as FolderCreateResult)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/folders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'create', name: 'docs' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(folderService.create).toHaveBeenCalledWith(WS.id, null, 'docs', expect.any(Object))
    expect(broadcastMock).toHaveBeenCalledWith(
      'folder:changed',
      WS.id,
      ['docs'],
      expect.any(Object)
    )
  })

  it('rename → folder:changed + note:changed + csv:changed broadcast', async () => {
    vi.mocked(folderRepository.findById).mockReturnValue(FOLDER)
    vi.mocked(folderService.rename).mockReturnValue({
      ...FOLDER,
      name: 'renamed',
      relativePath: 'renamed'
    } as unknown as FolderCreateResult)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/folders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'rename', folderId: FOLDER.id, newName: 'renamed' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(broadcastMock).toHaveBeenCalledWith(
      'folder:changed',
      WS.id,
      ['renamed'],
      expect.any(Object)
    )
    expect(broadcastMock).toHaveBeenCalledWith('note:changed', WS.id, [], expect.any(Object))
    expect(broadcastMock).toHaveBeenCalledWith('csv:changed', WS.id, [], expect.any(Object))
  })

  it('preflight: rename on 존재하지 않는 folder → 즉시 404 (folderService 호출 안 됨)', async () => {
    vi.mocked(folderRepository.findById).mockReturnValue(undefined)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/folders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'rename', folderId: 'fold-missing1', newName: 'x' }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
    expect(folderService.rename).not.toHaveBeenCalled()
  })

  it('preflight: move 시 자기 자신을 부모로 → 400 ValidationError', async () => {
    vi.mocked(folderRepository.findById).mockReturnValue(FOLDER)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/folders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [{ action: 'move', folderId: FOLDER.id, parentFolderId: FOLDER.id }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
    expect(folderService.move).not.toHaveBeenCalled()
  })

  it('preflight: 다른 워크스페이스 folder → 404 (정보 노출 방지)', async () => {
    vi.mocked(folderRepository.findById).mockReturnValue({
      ...FOLDER,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as FolderRow)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/folders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', folderId: FOLDER.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(404)
    expect(folderService.remove).not.toHaveBeenCalled()
  })

  it('delete → folder + note + csv broadcast', async () => {
    vi.mocked(folderRepository.findById).mockReturnValue(FOLDER)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/folders/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', folderId: FOLDER.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(folderService.remove).toHaveBeenCalledWith(WS.id, FOLDER.id)
    expect(broadcastMock).toHaveBeenCalledWith(
      'folder:changed',
      WS.id,
      ['docs'],
      expect.any(Object)
    )
    expect(broadcastMock).toHaveBeenCalledWith('note:changed', WS.id, [], expect.any(Object))
  })
})
