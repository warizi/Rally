/**
 * pages/folder/ui/FolderPage.test.tsx
 *
 * workspaceId 없음 → "워크스페이스를 선택해주세요." / 있음 → FolderTree 렌더.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: null as string | null
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@features/folder/manage-folder', () => ({
  FolderTree: ({ workspaceId, tabId }: { workspaceId: string; tabId?: string }) => (
    <div data-testid="folder-tree" data-ws={workspaceId} data-tab={tabId} />
  )
}))

import { FolderPage } from '../FolderPage'

beforeEach(() => {
  mocks.workspaceId = null
})

describe('FolderPage', () => {
  it('workspaceId 없음 → 안내 문구', () => {
    render(<FolderPage />)
    expect(screen.getByText('워크스페이스를 선택해주세요.')).toBeInTheDocument()
  })

  it('workspaceId 있음 → FolderTree 렌더 + workspaceId/tabId 전달', () => {
    mocks.workspaceId = 'ws-1'
    render(<FolderPage tabId="tab-1" />)
    const tree = screen.getByTestId('folder-tree')
    expect(tree).toHaveAttribute('data-ws', 'ws-1')
    expect(tree).toHaveAttribute('data-tab', 'tab-1')
  })
})
