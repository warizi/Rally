/**
 * MCP templates 라우트 단위 테스트.
 * - GET  /api/mcp/templates           (list_templates + type filter)
 * - GET  /api/mcp/templates/:id       (read_template + 소유권 가드)
 * - POST /api/mcp/templates/batch     (create / delete)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AUTH_HEADER } from '../../../lib/auth'
import { createRouter } from '../../../router'
import { registerMcpTemplateRoutes } from '../templates'
import { makeReq, makeRes } from '../../../__tests__/setup'

const SAVED_TOKEN = process.env.MCP_AUTH_TOKEN
const TEST_TOKEN = 'a'.repeat(64)

const { broadcastMock } = vi.hoisted(() => ({ broadcastMock: vi.fn() }))
vi.mock('../../../lib/broadcast', () => ({ broadcastChanged: broadcastMock }))

vi.mock('../../../../services/template', () => ({
  templateService: {
    listAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn()
  }
}))
vi.mock('../../../../repositories/template', () => ({
  templateRepository: { findById: vi.fn() }
}))
vi.mock('../../../../services/workspace-watcher', () => ({
  workspaceWatcher: { getActiveWorkspaceId: vi.fn() }
}))
vi.mock('../../../../repositories/workspace', () => ({
  workspaceRepository: { findById: vi.fn() }
}))

import { templateService } from '../../../../services/template'
import { templateRepository } from '../../../../repositories/template'
import { workspaceWatcher } from '../../../../services/workspace-watcher'
import { workspaceRepository } from '../../../../repositories/workspace'

type Template = NonNullable<ReturnType<typeof templateRepository.findById>>
type TemplateFromService = ReturnType<typeof templateService.findById>

const WS = {
  id: 'ws-abcdefghij',
  name: 'WS',
  path: '/p',
  createdAt: new Date(),
  updatedAt: new Date()
}

const TEMPLATE = {
  id: 'tmpl-aabbcc1',
  workspaceId: WS.id,
  title: 'My Template',
  type: 'note',
  jsonData: '{"a":1}',
  createdAt: new Date('2026-01-01T00:00:00Z')
} as unknown as Template

beforeEach(() => {
  process.env.MCP_AUTH_TOKEN = TEST_TOKEN
  vi.resetAllMocks()
  vi.mocked(workspaceWatcher.getActiveWorkspaceId).mockReturnValue(WS.id)
  vi.mocked(workspaceRepository.findById).mockReturnValue(WS)
  vi.mocked(templateService.listAll).mockReturnValue([])
})

afterEach(() => {
  if (SAVED_TOKEN === undefined) delete process.env.MCP_AUTH_TOKEN
  else process.env.MCP_AUTH_TOKEN = SAVED_TOKEN
})

function setupRouter(): ReturnType<typeof createRouter> {
  const router = createRouter()
  registerMcpTemplateRoutes(router)
  return router
}

describe('GET /api/mcp/templates', () => {
  it('type 미지정 → listAll(wsId, undefined) + jsonData 제외', async () => {
    vi.mocked(templateService.listAll).mockReturnValue([TEMPLATE as unknown as TemplateFromService])

    const router = setupRouter()
    const req = makeReq({ url: '/api/mcp/templates', headers: { [AUTH_HEADER]: TEST_TOKEN } })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(templateService.listAll).toHaveBeenCalledWith(WS.id, undefined)
    const body = cap.getJson<{ templates: { id: string; createdAt: string }[] }>()
    expect(body.templates[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
    // jsonData 가 summary 에 포함되지 않음
    expect((body.templates[0] as Record<string, unknown>).jsonData).toBeUndefined()
  })

  it('type=note → listAll(wsId, "note")', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/templates?type=note',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(templateService.listAll).toHaveBeenCalledWith(WS.id, 'note')
  })

  it('잘못된 type → 400', async () => {
    const router = setupRouter()
    const req = makeReq({
      url: '/api/mcp/templates?type=bogus',
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(400)
  })
})

describe('GET /api/mcp/templates/:id', () => {
  it('정상 → detail (jsonData 포함)', async () => {
    vi.mocked(templateRepository.findById).mockReturnValue(TEMPLATE)
    vi.mocked(templateService.findById).mockReturnValue(TEMPLATE as unknown as TemplateFromService)

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/templates/${TEMPLATE.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    const body = cap.getJson<{ id: string; jsonData: string }>()
    expect(body.id).toBe(TEMPLATE.id)
    expect(body.jsonData).toBe('{"a":1}')
  })

  it('다른 워크스페이스 → 404', async () => {
    vi.mocked(templateRepository.findById).mockReturnValue({
      ...TEMPLATE,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as Template)

    const router = setupRouter()
    const req = makeReq({
      url: `/api/mcp/templates/${TEMPLATE.id}`,
      headers: { [AUTH_HEADER]: TEST_TOKEN }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)
    expect(cap.getStatusCode()).toBe(404)
  })
})

describe('POST /api/mcp/templates/batch', () => {
  it('create → templateService.create + template:changed broadcast', async () => {
    vi.mocked(templateService.create).mockReturnValue(TEMPLATE as unknown as TemplateFromService)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/templates/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: {
        actions: [{ action: 'create', title: 'New', type: 'note', jsonData: '{}' }]
      }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(broadcastMock).toHaveBeenCalledWith('template:changed', WS.id, [])
  })

  it('delete → templateService.delete', async () => {
    vi.mocked(templateRepository.findById).mockReturnValue(TEMPLATE)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/templates/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: TEMPLATE.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(200)
    expect(templateService.delete).toHaveBeenCalledWith(TEMPLATE.id)
  })

  it('delete 시 다른 워크스페이스 → 404 (batch fail)', async () => {
    vi.mocked(templateRepository.findById).mockReturnValue({
      ...TEMPLATE,
      workspaceId: 'ws-otherzzzzz'
    } as unknown as Template)

    const router = setupRouter()
    const req = makeReq({
      method: 'POST',
      url: '/api/mcp/templates/batch',
      headers: { [AUTH_HEADER]: TEST_TOKEN, 'content-type': 'application/json' },
      body: { actions: [{ action: 'delete', id: TEMPLATE.id }] }
    })
    const cap = makeRes()
    await router.handle(req, cap.res)

    expect(cap.getStatusCode()).toBe(400)
    expect(templateService.delete).not.toHaveBeenCalled()
  })
})
