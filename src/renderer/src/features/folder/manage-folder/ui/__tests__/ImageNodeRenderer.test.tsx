/**
 * features/folder/manage-folder/ui/ImageNodeRenderer.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { NodeApi, NodeRendererProps } from '../../lib/tree'
import type { ImageTreeNode } from '../../model/types'

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

import { ImageNodeRenderer } from '../ImageNodeRenderer'

function makeNode(): NodeApi<ImageTreeNode> {
  return {
    id: 'i1',
    data: {
      id: 'i1',
      kind: 'image',
      name: 'photo',
      extension: '.png',
      updatedBy: 'me',
      updatedById: 'u1',
      updatedAt: 0
    },
    level: 0,
    childIndex: 0,
    parent: null,
    tree: { indent: 16 }
  } as unknown as NodeApi<ImageTreeNode>
}

const baseProps = {
  style: {},
  tree: {} as never,
  dragHandle: undefined,
  workspaceId: 'ws',
  sourcePaneId: 'p1',
  onOpen: vi.fn()
} as unknown as Omit<
  NodeRendererProps<ImageTreeNode> & {
    workspaceId: string
    sourcePaneId: string
    onOpen: () => void
  },
  'node'
>

beforeEach(() => {
  mocks.showExtension = false
})

describe('ImageNodeRenderer', () => {
  it('이름 노출', () => {
    render(<ImageNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByText('photo')).toBeInTheDocument()
  })

  it('showExtension=true → photo.png', () => {
    mocks.showExtension = true
    render(<ImageNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByText('photo.png')).toBeInTheDocument()
  })

  it('row 클릭 → onOpen', () => {
    const onOpen = vi.fn()
    render(<ImageNodeRenderer node={makeNode()} {...baseProps} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('photo'))
    expect(onOpen).toHaveBeenCalled()
  })
})
