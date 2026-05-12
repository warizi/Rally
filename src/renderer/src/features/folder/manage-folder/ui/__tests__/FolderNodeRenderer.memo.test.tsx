/**
 * FolderNodeRenderer React.memo 적용 확인 (P1-3 follow-up).
 *
 * react-arborist 의 다른 row 변경으로 부모가 re-render 될 때, 같은 폴더 row 의
 * NodeApi reference + workspaceId/sourcePaneId 가 동일하면 함수 본문 실행이
 * 건너뛰어지는지 확인. 측정은 globalThis 카운터 + vi.mock 으로 함수 body 진입을 추적.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { NodeApi, NodeRendererProps } from 'react-arborist'

// FolderNodeRenderer 가 사용하는 내부 hook 들을 stub — 카운터만 늘리는 가벼운 구현
vi.mock('../../model/use-tree-node-dnd', () => ({
  useTreeNodeDnd: () => ({
    setDragRef: () => {},
    setBeforeRef: () => {},
    setIntoRef: () => {},
    setAfterRef: () => {},
    dragAttributes: {},
    dragListeners: {},
    isDragging: false,
    isIntoOver: false,
    isBeforeOver: false,
    isAfterOver: false
  })
}))
vi.mock('../../model/use-auto-expand-on-hover', () => ({
  useAutoExpandOnHover: () => {}
}))
vi.mock('@shared/store/tree-drag.store', () => ({
  useTreeDragStore: () => false
}))

// 함수 body 진입 횟수를 측정하기 위해 TruncateTooltip 을 카운터로 wrap.
const renderCounter = { count: 0 }
vi.mock('@shared/ui/truncate-tooltip', () => ({
  TruncateTooltip: ({ children }: { children: React.ReactNode }) => {
    renderCounter.count++
    return <>{children}</>
  }
}))

import { FolderNodeRenderer } from '../FolderNodeRenderer'
import type { FolderTreeNode } from '../../model/types'

function makeProps(): NodeRendererProps<FolderTreeNode> & {
  workspaceId: string
  sourcePaneId: string
} {
  const folder: FolderTreeNode = {
    id: 'f1',
    kind: 'folder',
    name: 'Folder 1',
    color: '#ff0000',
    children: []
  } as unknown as FolderTreeNode

  const node = {
    id: 'f1',
    data: folder,
    level: 0,
    childIndex: 0,
    isOpen: false,
    parent: null,
    tree: { indent: 16 },
    toggle: vi.fn()
  } as unknown as NodeApi<FolderTreeNode>

  return {
    node,
    style: {},
    tree: {} as never,
    dragHandle: undefined,
    workspaceId: 'ws1',
    sourcePaneId: 'p1'
  } as unknown as NodeRendererProps<FolderTreeNode> & {
    workspaceId: string
    sourcePaneId: string
  }
}

describe('FolderNodeRenderer React.memo', () => {
  beforeEach(() => {
    renderCounter.count = 0
  })

  it('has memo displayName', () => {
    expect(FolderNodeRenderer.displayName).toBe('FolderNodeRenderer')
  })

  it('skips re-render when props reference unchanged', () => {
    const props = makeProps()
    const { rerender } = render(<FolderNodeRenderer {...props} />)
    expect(renderCounter.count).toBe(1)

    // 동일한 reference 로 다시 렌더 → memo 가 함수 본문 실행 skip
    rerender(<FolderNodeRenderer {...props} />)
    expect(renderCounter.count).toBe(1)
  })

  it('re-renders when workspaceId changes (memo cache miss)', () => {
    const props = makeProps()
    const { rerender } = render(<FolderNodeRenderer {...props} />)
    expect(renderCounter.count).toBe(1)

    rerender(<FolderNodeRenderer {...props} workspaceId="ws2" />)
    expect(renderCounter.count).toBe(2)
  })
})
