/**
 * widgets/terminal-panel/ui/TerminalBottomPanel.test.tsx
 *
 * hasBeenOpened=false → null. true → TerminalTabBar + 컨테이너 렌더.
 * useTerminalSession 은 sessionId 전달.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  hasBeenOpened: false,
  activeSessionId: null as null | string,
  useSessionCalls: [] as Array<unknown>
}))

vi.mock('@features/terminal', () => ({
  useTerminalPanelStore: (sel: (s: { hasBeenOpened: boolean }) => unknown) =>
    sel({ hasBeenOpened: mocks.hasBeenOpened })
}))
vi.mock('@features/terminal/model/store', () => ({
  useTerminalStore: (sel: (s: { activeSessionId: string | null }) => unknown) =>
    sel({ activeSessionId: mocks.activeSessionId })
}))
vi.mock('@features/terminal/model/use-terminal-session', () => ({
  useTerminalSession: (sessionId: string | null) => {
    mocks.useSessionCalls.push(sessionId)
  }
}))
vi.mock('../TerminalTabBar', () => ({
  TerminalTabBar: () => <div data-testid="terminal-tab-bar" />
}))

import { TerminalBottomPanel } from '../TerminalBottomPanel'

beforeEach(() => {
  mocks.hasBeenOpened = false
  mocks.activeSessionId = null
  mocks.useSessionCalls.length = 0
})

describe('TerminalBottomPanel', () => {
  it('hasBeenOpened=false → null, useTerminalSession(null)', () => {
    const { container } = render(<TerminalBottomPanel />)
    expect(container.firstChild).toBeNull()
    expect(mocks.useSessionCalls).toEqual([null])
  })

  it('hasBeenOpened=true → TerminalTabBar 렌더 + activeSessionId 전달', () => {
    mocks.hasBeenOpened = true
    mocks.activeSessionId = 'sess-1'
    render(<TerminalBottomPanel />)
    expect(screen.getByTestId('terminal-tab-bar')).toBeInTheDocument()
    expect(mocks.useSessionCalls).toEqual(['sess-1'])
  })
})
