/**
 * features/folder/manage-folder/ui/PdfNodeRenderer.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { NodeApi, NodeRendererProps } from '../../lib/tree'
import type { PdfTreeNode } from '../../model/types'

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

import { PdfNodeRenderer } from '../PdfNodeRenderer'

function makeNode(): NodeApi<PdfTreeNode> {
  return {
    id: 'p1',
    data: {
      id: 'p1',
      kind: 'pdf',
      name: 'doc',
      extension: '.pdf',
      updatedBy: 'me',
      updatedById: 'u1',
      updatedAt: 0
    },
    level: 0,
    childIndex: 0,
    parent: null,
    tree: { indent: 16 }
  } as unknown as NodeApi<PdfTreeNode>
}

const baseProps = {
  style: {},
  tree: {} as never,
  dragHandle: undefined,
  workspaceId: 'ws',
  sourcePaneId: 'p1',
  onOpen: vi.fn()
} as unknown as Omit<
  NodeRendererProps<PdfTreeNode> & {
    workspaceId: string
    sourcePaneId: string
    onOpen: () => void
  },
  'node'
>

beforeEach(() => {
  mocks.showExtension = false
})

describe('PdfNodeRenderer', () => {
  it('이름 노출', () => {
    render(<PdfNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByText('doc')).toBeInTheDocument()
  })

  it('showExtension=true → doc.pdf', () => {
    mocks.showExtension = true
    render(<PdfNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByText('doc.pdf')).toBeInTheDocument()
  })

  it('row 클릭 → onOpen', () => {
    const onOpen = vi.fn()
    render(<PdfNodeRenderer node={makeNode()} {...baseProps} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('doc'))
    expect(onOpen).toHaveBeenCalled()
  })
})
