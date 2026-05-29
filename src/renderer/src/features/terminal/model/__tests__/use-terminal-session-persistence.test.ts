/**
 * features/terminal/model/use-terminal-session-persistence.test.ts
 *
 * 워크스페이스 전환 시 세션 destroy + 새 세션 load. 빈 워크스페이스 첫 방문 시
 * 기본 zsh 세션 자동 생성. 같은 워크스페이스 재진입 시 destroy 호출 안 함.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: null as string | null,
  setWs: vi.fn(),
  terminalReset: vi.fn(),
  panelReset: vi.fn(),
  addSession: vi.fn(),
  sessions: {} as Record<string, { id: string; screenSnapshot: string | null }>
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('../store', () => ({
  useTerminalStore: {
    getState: () => ({
      sessions: mocks.sessions,
      addSession: mocks.addSession,
      reset: mocks.terminalReset
    })
  }
}))
vi.mock('../terminal-panel-store', () => ({
  useTerminalPanelStore: {
    getState: () => ({ reset: mocks.panelReset })
  }
}))

import { useTerminalSessionPersistence } from '../use-terminal-session-persistence'

beforeEach(() => {
  mocks.workspaceId = null
  mocks.setWs.mockClear()
  mocks.terminalReset.mockClear()
  mocks.panelReset.mockClear()
  mocks.addSession.mockClear()
  mocks.sessions = {}
  // 기본 mock — 모든 IPC 가 안전한 응답 반환 (unhandled rejection 방지).
  // 각 테스트가 필요 시 mockResolvedValueOnce 로 override.
  ;(window as unknown as Record<string, unknown>).api = {
    terminal: {
      getSessions: vi.fn().mockResolvedValue({ success: true, data: [] }),
      create: vi.fn().mockResolvedValue({ success: false, errorType: 'UnknownError', message: 'unmocked' }),
      saveSnapshot: vi.fn().mockResolvedValue({ success: true }),
      destroyAll: vi.fn().mockResolvedValue({ success: true })
    },
    workspace: {
      getById: vi
        .fn()
        .mockResolvedValue({ success: false, errorType: 'UnknownError', message: 'unmocked' })
    }
  }
})

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('useTerminalSessionPersistence', () => {
  it('workspaceId null → 아무 동작 안 함', () => {
    renderHook(() => useTerminalSessionPersistence())
    expect(api().terminal.getSessions).not.toHaveBeenCalled()
  })

  it('빈 세션 (첫 방문) → workspace.getById 로 cwd 얻고 기본 세션 1개 생성', async () => {
    mocks.workspaceId = 'ws-1'
    vi.mocked(api().terminal.getSessions).mockResolvedValue({ success: true, data: [] })
    vi.mocked(api().workspace.getById).mockResolvedValue({
      success: true,
      data: { id: 'ws-1', path: '/tmp/ws1' } as never
    })
    vi.mocked(api().terminal.create).mockResolvedValue({
      success: true,
      data: { id: 'new-session-id' }
    })

    renderHook(() => useTerminalSessionPersistence())
    await waitFor(() => expect(api().terminal.create).toHaveBeenCalled())

    expect(api().terminal.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', cwd: '/tmp/ws1', cols: 80, rows: 24 })
    )
    expect(mocks.addSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-session-id', name: 'zsh', cwd: '/tmp/ws1' })
    )
  })

  it('기존 세션 복원 → row.id 그대로 terminal:create 호출 + addSession', async () => {
    mocks.workspaceId = 'ws-1'
    vi.mocked(api().terminal.getSessions).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'sess-1',
          workspaceId: 'ws-1',
          name: 'zsh',
          cwd: '/x',
          shell: 'zsh',
          rows: 30,
          cols: 100,
          screenSnapshot: 'snap',
          sortOrder: 0
        } as never
      ]
    })
    vi.mocked(api().terminal.create).mockResolvedValue({
      success: true,
      data: { id: 'sess-1' }
    })

    renderHook(() => useTerminalSessionPersistence())
    await waitFor(() => expect(mocks.addSession).toHaveBeenCalled())

    expect(api().terminal.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess-1', cwd: '/x', cols: 100, rows: 30 })
    )
    expect(mocks.addSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sess-1', screenSnapshot: 'snap', sortOrder: 0 })
    )
  })

  it('getSessions 실패 → addSession 호출 안 함', async () => {
    mocks.workspaceId = 'ws-1'
    vi.mocked(api().terminal.getSessions).mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: 'no'
    })

    renderHook(() => useTerminalSessionPersistence())
    // 약간의 대기
    await new Promise((r) => setTimeout(r, 10))
    expect(mocks.addSession).not.toHaveBeenCalled()
  })

  it('beforeunload 이벤트 → 등록만 검증 (실제 호출은 환경 의존)', async () => {
    mocks.workspaceId = 'ws-1'
    const spy = vi.spyOn(window, 'addEventListener')
    renderHook(() => useTerminalSessionPersistence())
    expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    spy.mockRestore()
    // pending promise (handleSwitch) 가 unhandled rejection 으로 새지 않게 flush
    await new Promise((r) => setTimeout(r, 20))
  })
})
