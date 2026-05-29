/**
 * widgets/entity-link/ui/LinkedEntityList.test.tsx
 *
 * linked 비었음 → "연결된 항목이 없습니다". 있음 → 각 항목 + title 클릭 → onNavigate.
 * X 버튼 → useUnlinkEntity.mutate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeLinked {
  entityType: string
  entityId: string
  title: string
}

const mocks = vi.hoisted(() => ({
  linked: [] as FakeLinked[],
  unlinkMutate: vi.fn()
}))

vi.mock('@entities/entity-link', () => ({
  useLinkedEntities: () => ({ data: mocks.linked }),
  useUnlinkEntity: () => ({ mutate: mocks.unlinkMutate })
}))

vi.mock('@shared/lib/entity-link', () => ({
  ENTITY_TYPE_LABEL: { note: '노트', csv: '테이블', todo: '할 일' },
  ENTITY_TYPE_ICON: {
    note: () => <span data-testid="icon-note" />,
    csv: () => <span data-testid="icon-csv" />,
    todo: () => <span data-testid="icon-todo" />
  }
}))

vi.mock('@shared/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../PanePickerSubmenu', () => ({
  PanePickerSubmenu: ({
    children,
    onPaneSelect
  }: {
    children: (p: { onClick: () => void; isOpen: boolean }) => React.ReactNode
    onPaneSelect: (id: string) => void
  }) => (
    <div>
      <button data-testid="pane-trigger" onClick={() => onPaneSelect('pane-x')} />
      {children({ onClick: () => {}, isOpen: false })}
    </div>
  )
}))

import { LinkedEntityList } from '../LinkedEntityList'

beforeEach(() => {
  mocks.linked = []
  mocks.unlinkMutate.mockReset()
})

describe('LinkedEntityList', () => {
  it('linked 비었음 → 안내 텍스트', () => {
    render(<LinkedEntityList entityType="note" entityId="n1" />)
    expect(screen.getByText('연결된 항목이 없습니다')).toBeInTheDocument()
  })

  it('linked 있음 → 각 항목 title 노출', () => {
    mocks.linked = [
      { entityType: 'note', entityId: 'n1', title: 'Linked Note' },
      { entityType: 'csv', entityId: 'c1', title: 'Linked CSV' }
    ]
    render(<LinkedEntityList entityType="todo" entityId="t1" />)
    expect(screen.getByText('Linked Note')).toBeInTheDocument()
    expect(screen.getByText('Linked CSV')).toBeInTheDocument()
  })

  it('title 클릭 → onNavigate(type, id)', () => {
    mocks.linked = [{ entityType: 'note', entityId: 'n1', title: 'A' }]
    const onNavigate = vi.fn()
    render(<LinkedEntityList entityType="todo" entityId="t1" onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('A'))
    expect(onNavigate).toHaveBeenCalledWith('note', 'n1')
  })

  it('X 버튼 클릭 → unlinkEntity.mutate', () => {
    mocks.linked = [{ entityType: 'note', entityId: 'n1', title: 'A' }]
    const { container } = render(<LinkedEntityList entityType="todo" entityId="t1" />)
    const xBtn = container.querySelectorAll('button')
    // Last button = X (unlink)
    fireEvent.click(xBtn[xBtn.length - 1])
    expect(mocks.unlinkMutate).toHaveBeenCalledWith({
      typeA: 'todo',
      idA: 't1',
      typeB: 'note',
      idB: 'n1'
    })
  })

  it('PanePickerSubmenu trigger → onOpenInPane', () => {
    mocks.linked = [{ entityType: 'note', entityId: 'n1', title: 'A' }]
    const onOpenInPane = vi.fn()
    render(<LinkedEntityList entityType="todo" entityId="t1" onOpenInPane={onOpenInPane} />)
    fireEvent.click(screen.getByTestId('pane-trigger'))
    expect(onOpenInPane).toHaveBeenCalledWith('note', 'n1', 'pane-x')
  })
})
