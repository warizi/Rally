/**
 * features/folder/manage-folder/ui/NoteNodeRenderer.test.tsx
 *
 * displayName (showExtension 분기) + onOpen + isActive 클래스.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { NodeApi, NodeRendererProps } from '../../lib/tree'
import type { NoteTreeNode } from '../../model/types'

const mocks = vi.hoisted(() => ({ showExtension: false }))

vi.mock('../../model/use-tree-node-dnd', () => ({
  useTreeNodeDnd: () => ({
    setDragRef: () => {},
    setBeforeRef: () => {},
    setAfterRef: () => {},
    dragAttributes: {},
    dragListeners: {},
    isDragging: false,
    isBeforeOver: false,
    isAfterOver: false
  })
}))
vi.mock('../../model/use-show-extension-setting', () => ({
  useShowExtensionSetting: () => ({ enabled: mocks.showExtension })
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

import { NoteNodeRenderer } from '../NoteNodeRenderer'

function makeNode(): NodeApi<NoteTreeNode> {
  return {
    id: 'n1',
    data: {
      id: 'n1',
      kind: 'note',
      name: 'memo',
      extension: '.md',
      updatedBy: 'me',
      updatedById: 'u1',
      updatedAt: 0
    },
    level: 0,
    childIndex: 0,
    parent: null,
    tree: { indent: 16 }
  } as unknown as NodeApi<NoteTreeNode>
}

const baseProps = {
  style: {},
  tree: {} as never,
  dragHandle: undefined,
  workspaceId: 'ws',
  sourcePaneId: 'p1',
  onOpen: vi.fn()
} as unknown as Omit<
  NodeRendererProps<NoteTreeNode> & {
    workspaceId: string
    sourcePaneId: string
    onOpen: () => void
  },
  'node'
>

beforeEach(() => {
  mocks.showExtension = false
})

describe('NoteNodeRenderer', () => {
  it('showExtension=false → 확장자 미노출', () => {
    render(<NoteNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByText('memo')).toBeInTheDocument()
  })

  it('showExtension=true → memo.md', () => {
    mocks.showExtension = true
    render(<NoteNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByText('memo.md')).toBeInTheDocument()
  })

  it('row 클릭 → onOpen', () => {
    const onOpen = vi.fn()
    render(<NoteNodeRenderer node={makeNode()} {...baseProps} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('memo'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('isActive=true → bg-accent', () => {
    const { container } = render(<NoteNodeRenderer node={makeNode()} {...baseProps} isActive />)
    expect(container.querySelector('.bg-accent')).toBeInTheDocument()
  })
})
