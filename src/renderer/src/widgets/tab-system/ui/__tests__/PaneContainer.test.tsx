/**
 * widgets/tab-system/ui/PaneContainer.test.tsx
 *
 * pane null → fallback. activeTab focused → 빈 자리, 아니면 PaneContent.
 * isDragging=true → 5개의 TabDropZone 노출.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

interface FakePane {
  activeTabId: string | null
  tabIds: string[]
}

const mocks = vi.hoisted(() => ({
  panes: {} as Record<string, FakePane>,
  tabs: {} as Record<string, { id: string; pathname: string; searchParams: object }>,
  focusedTabId: null as null | string,
  setActivePane: vi.fn()
}))

vi.mock('@/entities/tab-system', () => {
  const selectFocusedTabId = (s: { focusedTabId: string | null }): string | null => s.focusedTabId
  return {
    selectFocusedTabId,
    useTabStore: (
      selector: (s: {
        panes: typeof mocks.panes
        tabs: typeof mocks.tabs
        focusedTabId: string | null
        setActivePane: typeof mocks.setActivePane
      }) => unknown
    ) =>
      selector({
        panes: mocks.panes,
        tabs: mocks.tabs,
        focusedTabId: mocks.focusedTabId,
        setActivePane: mocks.setActivePane
      })
  }
})

vi.mock('../TabBar', () => ({
  TabBar: ({ paneId }: { paneId: string }) => <div data-testid="tab-bar">{paneId}</div>
}))

vi.mock('../PaneContent', () => ({
  PaneContent: ({ tab }: { tab: { id: string } | null }) => (
    <div data-testid="pane-content">{tab?.id ?? 'empty'}</div>
  )
}))

vi.mock('../TabDropZone', () => ({
  TabDropZone: ({ position }: { position: string }) => <div data-testid={`dropzone-${position}`} />
}))

import { PaneContainer } from '../PaneContainer'

beforeEach(() => {
  mocks.panes = {}
  mocks.tabs = {}
  mocks.focusedTabId = null
  mocks.setActivePane.mockReset()
})

describe('PaneContainer', () => {
  it('pane 없으면 fallback div 만 렌더', () => {
    const { container } = render(<PaneContainer paneId="p1" routes={[]} isDragging={false} />)
    expect(screen.queryByTestId('tab-bar')).not.toBeInTheDocument()
    expect(container.querySelector('.flex-1.bg-muted')).toBeInTheDocument()
  })

  it('pane 있음 → TabBar + PaneContent 렌더', () => {
    mocks.panes = { p1: { activeTabId: 't1', tabIds: ['t1'] } }
    mocks.tabs = { t1: { id: 't1', pathname: '/x', searchParams: {} } }
    render(<PaneContainer paneId="p1" routes={[]} isDragging={false} />)
    expect(screen.getByTestId('tab-bar')).toHaveTextContent('p1')
    expect(screen.getByTestId('pane-content')).toHaveTextContent('t1')
  })

  it('focusedTabId === activeTab.id → PaneContent 미렌더 (자리만)', () => {
    mocks.panes = { p1: { activeTabId: 't1', tabIds: ['t1'] } }
    mocks.tabs = { t1: { id: 't1', pathname: '/x', searchParams: {} } }
    mocks.focusedTabId = 't1'
    render(<PaneContainer paneId="p1" routes={[]} isDragging={false} />)
    expect(screen.queryByTestId('pane-content')).not.toBeInTheDocument()
  })

  it('isDragging=true → 5개의 TabDropZone (top/right/bottom/left/center)', () => {
    mocks.panes = { p1: { activeTabId: null, tabIds: [] } }
    render(<PaneContainer paneId="p1" routes={[]} isDragging={true} />)
    expect(screen.getByTestId('dropzone-top')).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-right')).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-bottom')).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-left')).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-center')).toBeInTheDocument()
  })
})
