/**
 * features/tab-snapshot/manage-tab-snapshot/ui/TabSnapshotItem.test.tsx
 *
 * snapshot.name 노출. SidebarMenuButton 클릭 → onRestore.
 * preview 자식 컴포넌트 stub.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/ui/sidebar', () => ({
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({
    children,
    onClick
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} data-testid="restore-btn">
      {children}
    </button>
  )
}))

vi.mock('../TabSnapshotPreview', () => ({
  TabSnapshotPreview: ({ snapshot }: { snapshot: { name: string } }) => (
    <div data-testid="preview">{snapshot.name}</div>
  )
}))

import { TabSnapshotItem } from '../TabSnapshotItem'

const snap = {
  id: 's1',
  name: 'My Snapshot',
  description: null,
  workspaceId: 'ws',
  layoutJson: '{}',
  panesJson: '{}',
  tabsJson: '{}'
} as unknown as Parameters<typeof TabSnapshotItem>[0]['snapshot']

describe('TabSnapshotItem', () => {
  it('snapshot.name 노출', () => {
    render(
      <TabSnapshotItem
        snapshot={snap}
        onRestore={vi.fn()}
        onOverwrite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('My Snapshot')).toBeInTheDocument()
  })

  it('SidebarMenuButton 클릭 → onRestore', () => {
    const onRestore = vi.fn()
    render(
      <TabSnapshotItem
        snapshot={snap}
        onRestore={onRestore}
        onOverwrite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('restore-btn'))
    expect(onRestore).toHaveBeenCalled()
  })
})
