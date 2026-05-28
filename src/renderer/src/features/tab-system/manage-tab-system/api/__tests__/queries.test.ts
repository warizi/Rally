import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadSession, saveSession } from '../queries'

// ─── window.api mock ──────────────────────────────────
const mockGetByWorkspaceId = vi.fn()
const mockUpsert = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    tabSession: {
      getByWorkspaceId: mockGetByWorkspaceId,
      upsert: mockUpsert
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
    main: {
      id: 'main',
      tabIds: ['tab-dashboard'],
      activeTabId: 'tab-dashboard',
      size: 50,
      minSize: 200
    }
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
})

// ─── saveSession ──────────────────────────────────────
describe('saveSession', () => {
  it('upsert를 호출한다', async () => {
    mockUpsert.mockResolvedValue({ success: true, data: SESSION_ROW })

    await saveSession('ws-upsert', SAMPLE_SESSION_DATA)

    expect(mockUpsert).toHaveBeenCalledOnce()
  })

  it('upsert 시 올바른 payload를 전달한다', async () => {
    mockUpsert.mockResolvedValue({ success: true, data: SESSION_ROW })

    await saveSession('ws-payload', SAMPLE_SESSION_DATA)

    const payload = mockUpsert.mock.calls[0][0]
    expect(payload.workspaceId).toBe('ws-payload')
    expect(typeof payload.tabsJson).toBe('string')
    expect(typeof payload.panesJson).toBe('string')
    expect(typeof payload.layoutJson).toBe('string')
    expect(payload.activePaneId).toBe('main')
  })

  it('upsert 실패 시 throw한다', async () => {
    mockUpsert.mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: '저장 실패'
    })

    await expect(saveSession('ws-fail', SAMPLE_SESSION_DATA)).rejects.toThrow()
  })
})
