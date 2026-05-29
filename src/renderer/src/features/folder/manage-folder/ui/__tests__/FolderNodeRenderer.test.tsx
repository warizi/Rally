/**
 * features/folder/manage-folder/ui/FolderNodeRenderer.test.tsx
 *
 * folder name + ChevronRight isOpen 회전 + 클릭 시 toggle.
 * isMatch/isActiveMatch 클래스. AuthorBadge 노출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { NodeApi, NodeRendererProps } from '../../lib/tree'
import type { FolderTreeNode } from '../../model/types'

vi.mock('../../model/use-tree-node-dnd', () => ({
  useTreeNodeDnd: () => ({
    setDragRef: vi.fn(),
    setBeforeRef: vi.fn(),
    setAfterRef: vi.fn(),
    setIntoRef: vi.fn(),
    dragAttributes: {},
    dragListeners: {},
    isDragging: false,
    isIntoOver: false,
    isBeforeOver: false,
    isAfterOver: false
  })
}))

vi.mock('../../model/use-auto-expand-on-hover', () => ({
  useAutoExpandOnHover: vi.fn()
}))

vi.mock('@shared/store/tree-drag.store', () => ({
  useTreeDragStore: () => false
}))

vi.mock('@shared/ui/truncate-tooltip', () => ({
  TruncateTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('@shared/ui/author-badge', () => ({
  AuthorBadge: () => <span data-testid="author" />
}))

import { FolderNodeRenderer } from '../FolderNodeRenderer'

function makeNode(opts: { name?: string; isOpen?: boolean } = {}): NodeApi<FolderTreeNode> {
  const toggle = vi.fn()
  return {
    id: 'f1',
    data: {
      id: 'f1',
      kind: 'folder',
      name: opts.name ?? 'My Folder',
      color: '#ff0000',
      updatedBy: 'me',
      updatedById: 'u1',
      updatedAt: 0,
      children: []
    },
    level: 0,
    childIndex: 0,
    parent: null,
    tree: { indent: 16 },
    isOpen: opts.isOpen ?? false,
    toggle
  } as unknown as NodeApi<FolderTreeNode>
}

const baseProps = {
  style: {},
  tree: {} as never,
  dragHandle: undefined,
  workspaceId: 'ws',
  sourcePaneId: 'p1'
} as unknown as Omit<
  NodeRendererProps<FolderTreeNode> & { workspaceId: string; sourcePaneId: string },
  'node'
>

describe('FolderNodeRenderer', () => {
  it('folder name 노출 + 클릭 시 toggle', () => {
    const node = makeNode({ name: 'Folder X' })
    render(<FolderNodeRenderer node={node} {...baseProps} />)
    expect(screen.getByText('Folder X')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Folder X'))
    expect(node.toggle).toHaveBeenCalled()
  })

  it('isOpen=true → ChevronRight rotate-90 클래스', () => {
    const { container } = render(
      <FolderNodeRenderer node={makeNode({ isOpen: true })} {...baseProps} />
    )
    expect(container.innerHTML).toMatch(/rotate-90/)
  })

  it('isOpen=false → rotate-90 없음', () => {
    const { container } = render(
      <FolderNodeRenderer node={makeNode({ isOpen: false })} {...baseProps} />
    )
    expect(container.innerHTML).not.toMatch(/rotate-90/)
  })

  it('isMatch=true → bg-yellow-200 클래스', () => {
    const { container } = render(<FolderNodeRenderer node={makeNode()} {...baseProps} isMatch />)
    expect(container.innerHTML).toMatch(/bg-yellow-200/)
  })

  it('isActiveMatch=true → ring-yellow-500 클래스', () => {
    const { container } = render(
      <FolderNodeRenderer node={makeNode()} {...baseProps} isActiveMatch />
    )
    expect(container.innerHTML).toMatch(/ring-yellow-500/)
  })

  it('updatedBy 있음 → AuthorBadge 노출', () => {
    render(<FolderNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByTestId('author')).toBeInTheDocument()
  })
})
