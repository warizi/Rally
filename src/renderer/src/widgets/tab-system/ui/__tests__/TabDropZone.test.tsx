/**
 * widgets/tab-system/ui/TabDropZone.test.tsx
 *
 * isDragging=false → null. isFolderDrag → null. isOver → highlight.
 * position 별 className. center vs split-zone id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  isFolderDrag: false,
  isTreeDragActive: false,
  sourcePaneId: 'p1',
  isOver: false,
  lastDroppableId: '' as string
}))

vi.mock('@dnd-kit/core', () => ({
  useDroppable: (opts: { id: string; disabled?: boolean }) => {
    mocks.lastDroppableId = opts.id
    return { setNodeRef: vi.fn(), isOver: mocks.isOver }
  }
}))

vi.mock('@shared/store/tree-drag.store', () => ({
  useTreeDragStore: (
    sel: (s: { isFolderDrag: boolean; isTreeDragActive: boolean; sourcePaneId: string }) => unknown
  ) =>
    sel({
      isFolderDrag: mocks.isFolderDrag,
      isTreeDragActive: mocks.isTreeDragActive,
      sourcePaneId: mocks.sourcePaneId
    })
}))

import { TabDropZone } from '../TabDropZone'

beforeEach(() => {
  mocks.isFolderDrag = false
  mocks.isTreeDragActive = false
  mocks.sourcePaneId = 'p1'
  mocks.isOver = false
  mocks.lastDroppableId = ''
})

describe('TabDropZone', () => {
  it('isDragging=false → null', () => {
    const { container } = render(<TabDropZone paneId="p1" position="top" isDragging={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('isFolderDrag → null', () => {
    mocks.isFolderDrag = true
    const { container } = render(<TabDropZone paneId="p1" position="top" isDragging={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('isTreeDragActive + sourcePaneId === paneId → null', () => {
    mocks.isTreeDragActive = true
    mocks.sourcePaneId = 'p1'
    const { container } = render(<TabDropZone paneId="p1" position="top" isDragging={true} />)
    expect(container.firstChild).toBeNull()
  })

  it('isDragging=true → 감지 영역 div 렌더 (position-별 class)', () => {
    const { container } = render(<TabDropZone paneId="p1" position="right" isDragging={true} />)
    expect(container.querySelector('.absolute.z-50')).toBeInTheDocument()
  })

  it('isOver=true → highlight + 감지 영역 둘 다 렌더', () => {
    mocks.isOver = true
    const { container } = render(<TabDropZone paneId="p1" position="top" isDragging={true} />)
    expect(container.querySelector('.bg-primary\\/10')).toBeInTheDocument()
  })

  it('position=center → droppable id = pane:p1', () => {
    render(<TabDropZone paneId="p1" position="center" isDragging={true} />)
    expect(mocks.lastDroppableId).toBe('pane:p1')
  })

  it('position=top → droppable id = split-zone:p1:top', () => {
    render(<TabDropZone paneId="p1" position="top" isDragging={true} />)
    expect(mocks.lastDroppableId).toBe('split-zone:p1:top')
  })
})
