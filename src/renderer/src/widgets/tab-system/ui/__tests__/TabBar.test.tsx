/**
 * widgets/tab-system/ui/TabBar.test.tsx
 *
 * pane=null → fallback. pane 있음 → tabIds 매핑 TabItem 렌더.
 * "모두 닫기" 클릭 → closeAllTabs(paneId).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakePane {
  activeTabId: string | null
  tabIds: string[]
}

const mocks = vi.hoisted(() => ({
  panes: {} as Record<string, FakePane>,
  tabs: {} as Record<string, { id: string; title: string }>,
  activePaneId: 'p1',
  activateTab: vi.fn(),
  closeTab: vi.fn(),
  closeAllTabs: vi.fn()
}))

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false })
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  horizontalListSortingStrategy: {}
}))

vi.mock('@shared/store/tree-drag.store', () => ({
  useTreeDragStore: () => false
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../TabItem', () => ({
  TabItem: ({ tab }: { tab: { id: string; title: string } }) => (
    <div data-testid={`tab-item-${tab.id}`}>{tab.title}</div>
  )
}))

vi.mock('../TabContextMenu', () => ({
  TabContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (
    sel: (s: {
      panes: typeof mocks.panes
      tabs: typeof mocks.tabs
      activePaneId: string
      activateTab: typeof mocks.activateTab
      closeTab: typeof mocks.closeTab
      closeAllTabs: typeof mocks.closeAllTabs
    }) => unknown
  ) =>
    sel({
      panes: mocks.panes,
      tabs: mocks.tabs,
      activePaneId: mocks.activePaneId,
      activateTab: mocks.activateTab,
      closeTab: mocks.closeTab,
      closeAllTabs: mocks.closeAllTabs
    })
}))

vi.mock('@/shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollBar: () => null
}))

vi.mock('@/shared/ui/sidebar', () => ({
  useSidebar: () => ({ state: 'expanded' })
}))

vi.mock('@/shared/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({
    children,
    onClick
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>
}))

import { TabBar } from '../TabBar'

beforeEach(() => {
  mocks.panes = {}
  mocks.tabs = {}
  mocks.activePaneId = 'p1'
  mocks.activateTab.mockReset()
  mocks.closeTab.mockReset()
  mocks.closeAllTabs.mockReset()
})

describe('TabBar', () => {
  it('pane=null → 빈 fallback', () => {
    const { container } = render(<TabBar paneId="p-missing" />)
    expect(container.querySelector('.h-9.bg-muted')).toBeInTheDocument()
  })

  it('pane 있고 tabIds 비었음 → TabItem 미렌더', () => {
    mocks.panes = { p1: { activeTabId: null, tabIds: [] } }
    render(<TabBar paneId="p1" />)
    expect(screen.queryByTestId(/^tab-item-/)).not.toBeInTheDocument()
  })

  it('tabIds → 각 tab 별 TabItem 렌더', () => {
    mocks.panes = { p1: { activeTabId: 't1', tabIds: ['t1', 't2'] } }
    mocks.tabs = { t1: { id: 't1', title: 'A' }, t2: { id: 't2', title: 'B' } }
    render(<TabBar paneId="p1" />)
    expect(screen.getByTestId('tab-item-t1')).toBeInTheDocument()
    expect(screen.getByTestId('tab-item-t2')).toBeInTheDocument()
  })

  it('"모두 닫기" 클릭 → closeAllTabs(paneId)', () => {
    mocks.panes = { p1: { activeTabId: null, tabIds: [] } }
    render(<TabBar paneId="p1" />)
    fireEvent.click(screen.getByText('모두 닫기'))
    expect(mocks.closeAllTabs).toHaveBeenCalledWith('p1')
  })

  it('존재하지 않는 tabId 는 filter(Boolean) 으로 제거', () => {
    mocks.panes = { p1: { activeTabId: null, tabIds: ['t1', 't-missing'] } }
    mocks.tabs = { t1: { id: 't1', title: 'A' } }
    render(<TabBar paneId="p1" />)
    expect(screen.getByTestId('tab-item-t1')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-item-t-missing')).not.toBeInTheDocument()
  })

  it('showSidebarTrigger=true → sidebar trigger 노출 (smoke)', () => {
    mocks.panes = { p1: { activeTabId: null, tabIds: [] } }
    const { container } = render(<TabBar paneId="p1" showSidebarTrigger={true} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('showSidebarTrigger=false (기본) → 사이드바 트리거 미노출 (smoke)', () => {
    mocks.panes = { p1: { activeTabId: null, tabIds: [] } }
    const { container } = render(<TabBar paneId="p1" />)
    expect(container.firstChild).toBeTruthy()
  })

  it('isDragRegion=false → smoke 렌더', () => {
    mocks.panes = { p1: { activeTabId: null, tabIds: [] } }
    const { container } = render(<TabBar paneId="p1" isDragRegion={false} />)
    expect(container.firstChild).toBeTruthy()
  })
})
