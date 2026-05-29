/**
 * features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotSection.test.tsx
 *
 * snapshots 데이터 → 각 항목 TabSnapshotItem 렌더.
 * "현재 탭 저장" 클릭 → SaveSnapshotDialog 열림.
 * onRestore/onOverwrite/onEdit/onDelete prop 통과.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeSnap {
  id: string
  name: string
}

const mocks = vi.hoisted(() => ({
  snapshots: [] as FakeSnap[]
}))

vi.mock('@entities/tab-snapshot', () => ({
  useTabSnapshots: () => ({ data: mocks.snapshots })
}))

vi.mock('@shared/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@shared/ui/sidebar', () => ({
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({
    children,
    onClick
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>
}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../TabSnapshotItem', () => ({
  TabSnapshotItem: ({
    snapshot,
    onRestore,
    onEdit,
    onDelete
  }: {
    snapshot: FakeSnap
    onRestore: () => void
    onEdit: () => void
    onDelete: () => void
  }) => (
    <div data-testid={`item-${snapshot.id}`}>
      <button data-testid={`restore-${snapshot.id}`} onClick={onRestore}>
        restore
      </button>
      <button data-testid={`edit-${snapshot.id}`} onClick={onEdit}>
        edit
      </button>
      <button data-testid={`delete-${snapshot.id}`} onClick={onDelete}>
        delete
      </button>
    </div>
  )
}))

vi.mock('../SaveSnapshotDialog', () => ({
  SaveSnapshotDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="save-dialog" /> : null
}))

vi.mock('../EditSnapshotDialog', () => ({
  EditSnapshotDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="edit-dialog" /> : null
}))

vi.mock('../DeleteSnapshotDialog', () => ({
  DeleteSnapshotDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="delete-dialog" /> : null
}))

import { TabSnapshotSection } from '../TabSnapshotSection'

beforeEach(() => {
  mocks.snapshots = []
})

describe('TabSnapshotSection', () => {
  it('snapshots 비었음 → "현재 탭 저장" 버튼만 노출', () => {
    render(
      <TabSnapshotSection
        workspaceId="ws"
        onRestoreSnapshot={vi.fn()}
        onOverwriteSnapshot={vi.fn()}
      />
    )
    expect(screen.getAllByText('현재 탭 저장').length).toBeGreaterThan(0)
    expect(screen.queryByTestId(/^item-/)).not.toBeInTheDocument()
  })

  it('snapshots 있음 → 각 TabSnapshotItem 렌더', () => {
    mocks.snapshots = [
      { id: 's1', name: 'A' },
      { id: 's2', name: 'B' }
    ]
    render(
      <TabSnapshotSection
        workspaceId="ws"
        onRestoreSnapshot={vi.fn()}
        onOverwriteSnapshot={vi.fn()}
      />
    )
    expect(screen.getByTestId('item-s1')).toBeInTheDocument()
    expect(screen.getByTestId('item-s2')).toBeInTheDocument()
  })

  it('restore 버튼 → onRestoreSnapshot(snapshot)', () => {
    mocks.snapshots = [{ id: 's1', name: 'A' }]
    const onRestoreSnapshot = vi.fn()
    render(
      <TabSnapshotSection
        workspaceId="ws"
        onRestoreSnapshot={onRestoreSnapshot}
        onOverwriteSnapshot={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('restore-s1'))
    expect(onRestoreSnapshot).toHaveBeenCalledWith({ id: 's1', name: 'A' })
  })

  it('"현재 탭 저장" 클릭 → SaveSnapshotDialog 열림', () => {
    render(
      <TabSnapshotSection
        workspaceId="ws"
        onRestoreSnapshot={vi.fn()}
        onOverwriteSnapshot={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '현재 탭 저장' }))
    expect(screen.getByTestId('save-dialog')).toBeInTheDocument()
  })

  it('edit 버튼 → EditSnapshotDialog 열림', () => {
    mocks.snapshots = [{ id: 's1', name: 'A' }]
    render(
      <TabSnapshotSection
        workspaceId="ws"
        onRestoreSnapshot={vi.fn()}
        onOverwriteSnapshot={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('edit-s1'))
    expect(screen.getByTestId('edit-dialog')).toBeInTheDocument()
  })

  it('delete 버튼 → DeleteSnapshotDialog 열림', () => {
    mocks.snapshots = [{ id: 's1', name: 'A' }]
    render(
      <TabSnapshotSection
        workspaceId="ws"
        onRestoreSnapshot={vi.fn()}
        onOverwriteSnapshot={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('delete-s1'))
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument()
  })
})
