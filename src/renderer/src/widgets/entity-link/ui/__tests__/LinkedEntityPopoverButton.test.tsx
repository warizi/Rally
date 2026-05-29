/**
 * widgets/entity-link/ui/LinkedEntityPopoverButton.test.tsx
 *
 * linked.length 배지. handleNavigate → openTab. handleOpenInPane → closeTabByPathname + openTab.
 * 2개 이상 → OpenAllSubmenu 노출.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

interface FakeLinked {
  entityType: string
  entityId: string
  title: string
}

const mocks = vi.hoisted(() => ({
  linked: [] as FakeLinked[],
  todos: [] as Array<{ id: string; parentId: string | null }>,
  openTab: vi.fn(),
  closeTabByPathname: vi.fn(),
  receivedListProps: null as null | {
    onNavigate?: (t: string, id: string) => void
    onOpenInPane?: (t: string, id: string, paneId: string) => void
  }
}))

vi.mock('@entities/entity-link', () => ({
  useLinkedEntities: () => ({ data: mocks.linked })
}))

vi.mock('@entities/todo', () => ({
  useTodosByWorkspace: () => ({ data: mocks.todos })
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (
    sel: (s: {
      openTab: typeof mocks.openTab
      closeTabByPathname: typeof mocks.closeTabByPathname
    }) => unknown
  ) => sel({ openTab: mocks.openTab, closeTabByPathname: mocks.closeTabByPathname })
}))

vi.mock('../../lib/to-tab-options', () => ({
  toTabOptions: (type: string, id: string, title: string) => ({
    type,
    pathname: `/${type}/${id}`,
    title
  })
}))

vi.mock('@shared/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@shared/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../LinkedEntityList', () => ({
  LinkedEntityList: (props: {
    onNavigate?: (t: string, id: string) => void
    onOpenInPane?: (t: string, id: string, paneId: string) => void
  }) => {
    mocks.receivedListProps = props
    return <div data-testid="linked-list" />
  }
}))

vi.mock('../LinkEntityPopover', () => ({
  LinkEntityPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../OpenAllSubmenu', () => ({
  OpenAllSubmenu: () => <div data-testid="open-all" />
}))

import { LinkedEntityPopoverButton } from '../LinkedEntityPopoverButton'

beforeEach(() => {
  mocks.linked = []
  mocks.todos = []
  mocks.openTab.mockReset()
  mocks.closeTabByPathname.mockReset()
  mocks.receivedListProps = null
})

describe('LinkedEntityPopoverButton', () => {
  it('linked 비었음 → 배지 미노출 + OpenAllSubmenu 미노출', () => {
    render(<LinkedEntityPopoverButton entityType="note" entityId="n1" workspaceId="ws" />)
    expect(screen.queryByTestId('open-all')).not.toBeInTheDocument()
  })

  it('linked 1개 → 배지 노출 + OpenAllSubmenu 미노출', () => {
    mocks.linked = [{ entityType: 'note', entityId: 'n2', title: 'A' }]
    render(<LinkedEntityPopoverButton entityType="note" entityId="n1" workspaceId="ws" />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByTestId('open-all')).not.toBeInTheDocument()
  })

  it('linked 2개 이상 → 배지 + OpenAllSubmenu 노출', () => {
    mocks.linked = [
      { entityType: 'note', entityId: 'n2', title: 'A' },
      { entityType: 'csv', entityId: 'c1', title: 'B' }
    ]
    render(<LinkedEntityPopoverButton entityType="note" entityId="n1" workspaceId="ws" />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByTestId('open-all')).toBeInTheDocument()
  })

  it('onNavigate prop 전달 → openTab(options)', () => {
    mocks.linked = [{ entityType: 'note', entityId: 'n2', title: 'Target' }]
    render(<LinkedEntityPopoverButton entityType="note" entityId="n1" workspaceId="ws" />)
    mocks.receivedListProps?.onNavigate?.('note', 'n2')
    expect(mocks.openTab).toHaveBeenCalledWith({
      type: 'note',
      pathname: '/note/n2',
      title: 'Target'
    })
  })

  it('onOpenInPane → closeTabByPathname + openTab(options, paneId)', () => {
    mocks.linked = [{ entityType: 'note', entityId: 'n2', title: 'X' }]
    render(<LinkedEntityPopoverButton entityType="note" entityId="n1" workspaceId="ws" />)
    mocks.receivedListProps?.onOpenInPane?.('note', 'n2', 'pane-x')
    expect(mocks.closeTabByPathname).toHaveBeenCalledWith('/note/n2')
    expect(mocks.openTab).toHaveBeenCalledWith(expect.any(Object), 'pane-x')
  })
})
