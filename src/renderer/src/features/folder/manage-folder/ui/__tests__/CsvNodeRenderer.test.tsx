/**
 * features/folder/manage-folder/ui/CsvNodeRenderer.test.tsx
 *
 * displayName (showExtension on/off) + onOpen 클릭 핸들러 + 활성/매치 상태 클래스.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { NodeApi, NodeRendererProps } from '../../lib/tree'
import type { CsvTreeNode } from '../../model/types'

const mocks = vi.hoisted(() => ({
  showExtension: false
}))

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

import { CsvNodeRenderer } from '../CsvNodeRenderer'

function makeNode(): NodeApi<CsvTreeNode> {
  return {
    id: 'c1',
    data: {
      id: 'c1',
      kind: 'csv',
      name: 'sheet',
      extension: '.csv',
      updatedBy: 'me',
      updatedById: 'u1',
      updatedAt: 0
    },
    level: 0,
    childIndex: 0,
    parent: null,
    tree: { indent: 16 }
  } as unknown as NodeApi<CsvTreeNode>
}

const baseProps = {
  style: {},
  tree: {} as never,
  dragHandle: undefined,
  workspaceId: 'ws',
  sourcePaneId: 'p1',
  onOpen: vi.fn()
} as unknown as Omit<
  NodeRendererProps<CsvTreeNode> & {
    workspaceId: string
    sourcePaneId: string
    onOpen: () => void
  },
  'node'
>

beforeEach(() => {
  mocks.showExtension = false
})

describe('CsvNodeRenderer', () => {
  it('showExtension=false → 확장자 미노출', () => {
    render(<CsvNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByText('sheet')).toBeInTheDocument()
    expect(screen.queryByText('sheet.csv')).not.toBeInTheDocument()
  })

  it('showExtension=true → 확장자 포함 노출', () => {
    mocks.showExtension = true
    render(<CsvNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByText('sheet.csv')).toBeInTheDocument()
  })

  it('row 클릭 → onOpen', () => {
    const onOpen = vi.fn()
    render(<CsvNodeRenderer node={makeNode()} {...baseProps} onOpen={onOpen} />)
    fireEvent.click(screen.getByText('sheet'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('isActive=true → bg-accent 클래스', () => {
    const { container } = render(<CsvNodeRenderer node={makeNode()} {...baseProps} isActive />)
    expect(container.querySelector('.bg-accent')).toBeInTheDocument()
  })

  it('isMatch=true → bg-yellow-200/40 클래스 포함', () => {
    const { container } = render(<CsvNodeRenderer node={makeNode()} {...baseProps} isMatch />)
    expect(container.innerHTML).toMatch(/bg-yellow-200/)
  })

  it('updatedBy 있음 → AuthorBadge 렌더', () => {
    render(<CsvNodeRenderer node={makeNode()} {...baseProps} />)
    expect(screen.getByTestId('author')).toBeInTheDocument()
  })
})
