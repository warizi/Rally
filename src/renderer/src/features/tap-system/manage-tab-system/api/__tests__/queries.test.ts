import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadSession, saveSession } from '../queries'

// ─── window.api mock ──────────────────────────────────
const mockGetByWorkspaceId = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    tabSession: {
      getByWorkspaceId: mockGetByWorkspaceId,
      create: mockCreate,
      update: mockUpdate
    }
  }
  vi.clearAllMocks()
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

// ─── 테스트 픽스처 ─────────────────────────────────────
const SESSION_ROW = {
  id: 1,
  workspaceId: 'ws-test',
  tabsJson: JSON.stringify({
    'tab-dashboard': {
      id: 'tab-dashboard',
      type: 'dashboard',
      title: '대시보드',
      pathname: '/dashboard',
      pinned: false,
      createdAt: 1000,
      lastAccessedAt: 1000
    }
  }),
  panesJson: JSON.stringify({
    main: { id: 'main', tabIds: ['tab-dashboard'], activeTabId: 'tab-dashboard', size: 50, minSize: 200 }
  }),
  layoutJson: JSON.stringify({ id: 'l1', type: 'pane', paneId: 'main' }),
  activePaneId: 'main'
}

const SAMPLE_SESSION_DATA = {
  tabs: {},
  panes: {},
  layout: { id: 'l1', type: 'pane' as const, paneId: 'main' },
  activePaneId: 'main'
}

// ─── loadSession ──────────────────────────────────────
describe('loadSession', () => {
  it('세션 데이터를 파싱하여 반환한다', async () => {
    mockGetByWorkspaceId.mockResolvedValue({ success: true, data: SESSION_ROW })

    const result = await loadSession('ws-load')

    expect(result).not.toBeNull()
    expect(result?.activePaneId).toBe('main')
    expect(result?.tabs['tab-dashboard']).toBeDefined()
    expect(mockGetByWorkspaceId).toHaveBeenCalledWith('ws-load')
  })

  it('NotFoundError면 null을 반환한다', async () => {
    mockGetByWorkspaceId.mockResolvedValue({
      success: false,
      errorType: 'NotFoundError',
      message: '세션 없음'
    })

    const result = await loadSession('ws-notfound')

    expect(result).toBeNull()
  })

  it('NotFoundError 외 다른 에러면 throw한다', async () => {
    mockGetByWorkspaceId.mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: '서버 오류'
    })

    await expect(loadSession('ws-error')).rejects.toThrow()
  })

  it('tabs / panes / layout JSON을 올바르게 파싱하고 필드 값을 검증한다', async () => {
    mockGetByWorkspaceId.mockResolvedValue({ success: true, data: SESSION_ROW })

    const result = await loadSession('ws-parse')

    // tabs
    expect(result?.tabs['tab-dashboard'].type).toBe('dashboard')
    expect(result?.tabs['tab-dashboard'].pathname).toBe('/dashboard')
    expect(result?.tabs['tab-dashboard'].pinned).toBe(false)
    // panes
    expect(result?.panes['main'].tabIds).toContain('tab-dashboard')
    expect(result?.panes['main'].activeTabId).toBe('tab-dashboard')
    // layout
    expect(result?.layout.type).toBe('pane')
  })

  it('NotFoundError는 sessionIdCache에 저장하지 않는다 (이후 save 시 create 경로 유지)', async () => {
    const wsId = `ws-notfound-cache-${Date.now()}-${Math.random()}`
    mockGetByWorkspaceId.mockResolvedValue({
      success: false,
      errorType: 'NotFoundError',
      message: '세션 없음'
    })
    mockCreate.mockResolvedValue({ success: true, data: { id: 200 } })

    await loadSession(wsId)          // null 반환, 캐시 저장 없어야 함
    await saveSession(wsId, SAMPLE_SESSION_DATA)  // create 경로여야 함

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

// ─── saveSession ──────────────────────────────────────
describe('saveSession', () => {
  it('캐시에 없는 workspaceId면 create를 호출한다', async () => {
    // 고유 wsId 사용 (캐시 충돌 방지)
    const wsId = `ws-create-${Date.now()}-${Math.random()}`
    mockCreate.mockResolvedValue({ success: true, data: { id: 99 } })

    await saveSession(wsId, SAMPLE_SESSION_DATA)

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('create 시 올바른 payload를 전달한다', async () => {
    const wsId = `ws-payload-${Date.now()}-${Math.random()}`
    mockCreate.mockResolvedValue({ success: true, data: { id: 100 } })

    await saveSession(wsId, SAMPLE_SESSION_DATA)

    const payload = mockCreate.mock.calls[0][0]
    expect(payload.workspaceId).toBe(wsId)
    expect(typeof payload.tabsJson).toBe('string')
    expect(typeof payload.panesJson).toBe('string')
    expect(typeof payload.layoutJson).toBe('string')
    expect(payload.activePaneId).toBe('main')
  })

  it('loadSession 후 동일 workspaceId로 saveSession하면 update를 호출한다', async () => {
    const wsId = `ws-update-${Date.now()}-${Math.random()}`
    mockGetByWorkspaceId.mockResolvedValue({ success: true, data: { ...SESSION_ROW, id: 42 } })
    mockUpdate.mockResolvedValue({ success: true })

    await loadSession(wsId)
    await saveSession(wsId, SAMPLE_SESSION_DATA)

    expect(mockUpdate).toHaveBeenCalledOnce()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('update payload에 id가 포함된다', async () => {
    const wsId = `ws-update-id-${Date.now()}-${Math.random()}`
    mockGetByWorkspaceId.mockResolvedValue({ success: true, data: { ...SESSION_ROW, id: 77 } })
    mockUpdate.mockResolvedValue({ success: true })

    await loadSession(wsId)
    await saveSession(wsId, SAMPLE_SESSION_DATA)

    const payload = mockUpdate.mock.calls[0][0]
    expect(payload.id).toBe(77)
  })

  it('create 실패 시 throw한다', async () => {
    const wsId = `ws-create-fail-${Date.now()}-${Math.random()}`
    mockCreate.mockResolvedValue({ success: false, errorType: 'UnknownError', message: '저장 실패' })

    await expect(saveSession(wsId, SAMPLE_SESSION_DATA)).rejects.toThrow()
  })

  it('update 실패 시 throw한다', async () => {
    const wsId = `ws-update-fail-${Date.now()}-${Math.random()}`
    mockGetByWorkspaceId.mockResolvedValue({ success: true, data: { ...SESSION_ROW, id: 55 } })
    mockUpdate.mockResolvedValue({ success: false, errorType: 'UnknownError', message: '업데이트 실패' })

    await loadSession(wsId)
    await expect(saveSession(wsId, SAMPLE_SESSION_DATA)).rejects.toThrow()
  })

  it('create 성공 후 재호출하면 update 경로를 사용한다', async () => {
    // create 시 응답에서 받은 id가 캐시에 저장되어 두 번째 save에서 update를 사용해야 함
    const wsId = `ws-create-then-update-${Date.now()}-${Math.random()}`
    mockCreate.mockResolvedValue({ success: true, data: { id: 300 } })
    mockUpdate.mockResolvedValue({ success: true })

    await saveSession(wsId, SAMPLE_SESSION_DATA)  // create
    await saveSession(wsId, SAMPLE_SESSION_DATA)  // update (id=300 캐시)

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockUpdate).toHaveBeenCalledOnce()
    expect(mockUpdate.mock.calls[0][0].id).toBe(300)
  })
})
