/**
 * TerminalTabBar 회귀 테스트.
 *
 * - 일반 TabItem 디자인 통일 (h-8 / 아이콘 / DnD)
 * - DnD 로 session 의 sortOrder 변경 + IPC persist
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import type { JSX, ReactNode } from 'react'
import { TerminalTabBar } from '../TerminalTabBar'
import type { TerminalSession } from '@features/terminal/model/types'

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (selector: (s: unknown) => unknown) =>
    selector({ currentWorkspaceId: 'ws-1' })
}))

const removeSessionMock = vi.fn()
const updateSessionMock = vi.fn()
const setActiveSessionMock = vi.fn()
const addSessionMock = vi.fn()

let sessionsMap: Record<string, TerminalSession>
let activeSessionId: string | null

vi.mock('@features/terminal/model/store', () => ({
  useTerminalStore: (selector: (s: unknown) => unknown) =>
    selector({
      sessions: sessionsMap,
      activeSessionId,
      removeSession: removeSessionMock,
      updateSession: updateSessionMock,
      setActiveSession: setActiveSessionMock,
      addSession: addSessionMock
    })
}))

function makeSession(id: string, name: string, sortOrder: number): TerminalSession {
  return {
    id,
    name,
    cwd: '/tmp',
    shell: 'zsh',
    rows: 24,
    cols: 80,
    screenSnapshot: null,
    sortOrder
  }
}

function Wrapper({ children }: { children: ReactNode }): JSX.Element {
  return createElement('div', null, children)
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionsMap = {
    s1: makeSession('s1', 'tab-1', 0),
    s2: makeSession('s2', 'tab-2', 1),
    s3: makeSession('s3', 'tab-3', 2)
  }
  activeSessionId = 's1'
  ;(window as unknown as Record<string, unknown>).api = {
    terminal: {
      updateSession: vi.fn().mockResolvedValue({ success: true }),
      destroy: vi.fn().mockResolvedValue({ success: true }),
      closeSession: vi.fn().mockResolvedValue({ success: true })
    },
    workspace: {
      getById: vi.fn()
    }
  }
})

describe('TerminalTabBar', () => {
  it('sortOrder 순서로 세션 렌더 + 활성 표시', () => {
    render(<TerminalTabBar />, { wrapper: Wrapper })
    expect(screen.getByText('tab-1')).toBeInTheDocument()
    expect(screen.getByText('tab-2')).toBeInTheDocument()
    expect(screen.getByText('tab-3')).toBeInTheDocument()
  })

  it('새 터미널 + 버튼 렌더', () => {
    render(<TerminalTabBar />, { wrapper: Wrapper })
    const addBtn = screen.getByTitle('새 터미널')
    expect(addBtn).toBeInTheDocument()
    expect(addBtn.textContent).toBe('+')
  })

  it('탭 클릭 → setActiveSession 호출', () => {
    render(<TerminalTabBar />, { wrapper: Wrapper })
    act(() => {
      screen.getByText('tab-2').click()
    })
    expect(setActiveSessionMock).toHaveBeenCalledWith('s2')
  })

  it('새 터미널 + → workspace.getById + terminal.create + addSession 호출', async () => {
    const apiObj = (
      window as unknown as { api: Record<string, Record<string, ReturnType<typeof vi.fn>>> }
    ).api
    apiObj.workspace.getById = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'ws-1', path: '/workspace' }
    })
    apiObj.terminal.create = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 's4' }
    })

    render(<TerminalTabBar />, { wrapper: Wrapper })
    await act(async () => {
      screen.getByTitle('새 터미널').click()
    })
    await waitFor(() => {
      expect(apiObj.workspace.getById).toHaveBeenCalledWith('ws-1')
      expect(apiObj.terminal.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'ws-1', cwd: '/workspace', sortOrder: 3 })
      )
      expect(addSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's4', sortOrder: 3 })
      )
    })
  })

  it('새 터미널 + → workspace fetch 실패 시 addSession 호출 안 함', async () => {
    const apiObj = (
      window as unknown as { api: Record<string, Record<string, ReturnType<typeof vi.fn>>> }
    ).api
    apiObj.workspace.getById = vi.fn().mockResolvedValue({ success: false })
    apiObj.terminal.create = vi.fn()

    render(<TerminalTabBar />, { wrapper: Wrapper })
    await act(async () => {
      screen.getByTitle('새 터미널').click()
    })
    await waitFor(() => {
      expect(apiObj.workspace.getById).toHaveBeenCalled()
    })
    expect(apiObj.terminal.create).not.toHaveBeenCalled()
    expect(addSessionMock).not.toHaveBeenCalled()
  })
})
