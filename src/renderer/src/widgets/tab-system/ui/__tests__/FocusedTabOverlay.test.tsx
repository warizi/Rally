/**
 * widgets/tab-system/ui/FocusedTabOverlay.test.tsx
 *
 * focusedTabId=null → 오버레이 미렌더.
 * focusedTab 있음 → 오버레이 + 닫기 버튼 → exitFocusMode.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeTab {
  id: string
  pathname: string
  searchParams: object
}

const mocks = vi.hoisted(() => ({
  focusedTabId: null as string | null,
  tabs: {} as Record<string, FakeTab>,
  exitFocusMode: vi.fn()
}))

vi.mock('@/entities/tab-system', () => {
  const selectFocusedTabId = (s: { focusedTabId: string | null }): string | null => s.focusedTabId
  return {
    selectFocusedTabId,
    useTabStore: (
      sel: (s: {
        focusedTabId: string | null
        tabs: typeof mocks.tabs
        exitFocusMode: typeof mocks.exitFocusMode
      }) => unknown
    ) =>
      sel({
        focusedTabId: mocks.focusedTabId,
        tabs: mocks.tabs,
        exitFocusMode: mocks.exitFocusMode
      })
  }
})

vi.mock('../PaneContent', () => ({
  PaneContent: ({ tab }: { tab: { id: string } | null }) => (
    <div data-testid="pane-content">{tab?.id}</div>
  )
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) => {
      // strip motion-specific props
      const { initial: _i, animate: _a, exit: _e, transition: _t, ...domProps } = rest
      return <div {...(domProps as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    }
  }
}))

import { FocusedTabOverlay } from '../FocusedTabOverlay'

beforeEach(() => {
  mocks.focusedTabId = null
  mocks.tabs = {}
  mocks.exitFocusMode.mockReset()
})

describe('FocusedTabOverlay', () => {
  it('focusedTabId=null → PaneContent 미렌더', () => {
    render(<FocusedTabOverlay routes={[]} />)
    expect(screen.queryByTestId('pane-content')).not.toBeInTheDocument()
  })

  it('focusedTabId 있음 → 오버레이 + PaneContent 렌더', () => {
    mocks.focusedTabId = 't1'
    mocks.tabs = { t1: { id: 't1', pathname: '/x', searchParams: {} } }
    render(<FocusedTabOverlay routes={[]} />)
    expect(screen.getByTestId('pane-content')).toHaveTextContent('t1')
  })

  it('X 버튼 클릭 → exitFocusMode', () => {
    mocks.focusedTabId = 't1'
    mocks.tabs = { t1: { id: 't1', pathname: '/x', searchParams: {} } }
    render(<FocusedTabOverlay routes={[]} />)
    fireEvent.click(screen.getByLabelText('화면 전체보기 해제'))
    expect(mocks.exitFocusMode).toHaveBeenCalled()
  })
})
