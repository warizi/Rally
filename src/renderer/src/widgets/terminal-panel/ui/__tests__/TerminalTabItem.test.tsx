/**
 * widgets/terminal-panel/ui/TerminalTabItem.test.tsx
 *
 * session.name 노출 + isActive 활성 클래스. close 버튼 → terminal API.
 * 이름변경 dialog open/close.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  removeSession: vi.fn(),
  updateSession: vi.fn(),
  destroy: vi.fn(),
  closeSession: vi.fn(),
  updateSessionApi: vi.fn()
}))

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false
  })
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } }
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...rest
    }: {
      children: React.ReactNode
    } & Record<string, unknown>) => {
      const { initial: _i, animate: _a, exit: _e, transition: _t, ...domProps } = rest
      return <div {...(domProps as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    }
  }
}))

vi.mock('@features/terminal/model/store', () => ({
  useTerminalStore: (
    sel: (s: {
      removeSession: typeof mocks.removeSession
      updateSession: typeof mocks.updateSession
    }) => unknown
  ) => sel({ removeSession: mocks.removeSession, updateSession: mocks.updateSession })
}))

vi.mock('@shared/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="context-menu">{children}</div>
  ),
  ContextMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  ContextMenuSeparator: () => <hr />
}))

import { TerminalTabItem } from '../TerminalTabItem'

const baseSession = {
  id: 's1',
  name: 'zsh',
  cwd: '/tmp',
  shell: 'zsh',
  rows: 24,
  cols: 80,
  screenSnapshot: null,
  sortOrder: 0
} as unknown as Parameters<typeof TerminalTabItem>[0]['session']

beforeEach(() => {
  mocks.removeSession.mockReset()
  mocks.updateSession.mockReset()
  mocks.destroy.mockReset()
  mocks.closeSession.mockReset()
  mocks.updateSessionApi.mockReset()
  ;(window as unknown as Record<string, unknown>).api = {
    terminal: {
      destroy: mocks.destroy,
      closeSession: mocks.closeSession,
      updateSession: mocks.updateSessionApi
    }
  }
})

describe('TerminalTabItem', () => {
  it('session.name 노출', () => {
    render(<TerminalTabItem session={baseSession} isActive={false} onActivate={vi.fn()} />)
    expect(screen.getByText('zsh')).toBeInTheDocument()
  })

  it('isActive=true → 활성 스타일 적용', () => {
    const { container } = render(
      <TerminalTabItem session={baseSession} isActive={true} onActivate={vi.fn()} />
    )
    // 활성 스타일: bg-background text-foreground
    expect(container.innerHTML).toMatch(/bg-background/)
  })

  it('탭 클릭 → onActivate', () => {
    const onActivate = vi.fn()
    render(<TerminalTabItem session={baseSession} isActive={false} onActivate={onActivate} />)
    fireEvent.click(screen.getByText('zsh').closest('div')!)
    expect(onActivate).toHaveBeenCalled()
  })

  it('context menu 에 "이름 변경" / "닫기" 노출', () => {
    render(<TerminalTabItem session={baseSession} isActive={false} onActivate={vi.fn()} />)
    expect(screen.getByText('이름 변경')).toBeInTheDocument()
    expect(screen.getByText('탭 닫기')).toBeInTheDocument()
  })

  it('"탭 닫기" 클릭 → terminal.destroy + removeSession 호출', async () => {
    mocks.destroy.mockResolvedValue({ success: true })
    mocks.closeSession.mockResolvedValue({ success: true })
    render(<TerminalTabItem session={baseSession} isActive={false} onActivate={vi.fn()} />)
    fireEvent.click(screen.getByText('탭 닫기'))
    await waitFor(() => {
      expect(mocks.destroy).toHaveBeenCalledWith('s1')
      expect(mocks.removeSession).toHaveBeenCalledWith('s1')
    })
  })

  it('"이름 변경" 클릭 → rename dialog 열림', () => {
    render(<TerminalTabItem session={baseSession} isActive={false} onActivate={vi.fn()} />)
    fireEvent.click(screen.getByText('이름 변경'))
    expect(screen.getByText('터미널 이름 변경')).toBeInTheDocument()
  })
})
