/**
 * features/folder/manage-folder/model/use-tree-node-dnd.test.ts
 *
 * useDraggable + 3 useDroppable wrapper. dnd-kit mock 으로 호출 인자만 캡처.
 * dropDisabled: 트리 드래그 비활성 시 모든 슬롯 disabled. polder slot 은 isFolder=false 면 항상 disabled.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const dnd = vi.hoisted(() => ({
  draggableArgs: null as null | { id: string; data: unknown },
  droppableCalls: [] as Array<{ id: string; data: unknown; disabled?: boolean }>,
  isTreeDragActive: true
}))

vi.mock('@dnd-kit/core', () => ({
  useDraggable: (args: { id: string; data: unknown }) => {
    dnd.draggableArgs = args
    return {
      setNodeRef: vi.fn(),
      attributes: {},
      listeners: {},
      isDragging: false
    }
  },
  useDroppable: (args: { id: string; data: unknown; disabled?: boolean }) => {
    dnd.droppableCalls.push(args)
    return { setNodeRef: vi.fn(), isOver: false }
  }
}))
vi.mock('@shared/store/tree-drag.store', () => ({
  useTreeDragStore: (sel: (s: { isTreeDragActive: boolean }) => unknown) =>
    sel({ isTreeDragActive: dnd.isTreeDragActive })
}))

import { useTreeNodeDnd } from '../use-tree-node-dnd'

beforeEach(() => {
  dnd.draggableArgs = null
  dnd.droppableCalls = []
  dnd.isTreeDragActive = true
})

const baseArgs = {
  workspaceId: 'ws-1',
  sourcePaneId: 'p-1',
  kind: 'note' as const,
  id: 'n-1',
  title: 'My note',
  parentId: 'f-1',
  index: 2,
  isFolder: false
}

describe('useTreeNodeDnd — useDraggable 호출 인자', () => {
  it('draggable id 는 TREE_NODE_DRAG_PREFIX + id', () => {
    renderHook(() => useTreeNodeDnd(baseArgs))
    expect(dnd.draggableArgs?.id).toBe('tree-node:n-1')
    expect(dnd.draggableArgs?.data).toMatchObject({
      source: 'tree-node',
      workspaceId: 'ws-1',
      sourcePaneId: 'p-1',
      kind: 'note',
      id: 'n-1',
      title: 'My note',
      parentId: 'f-1'
    })
  })
})

describe('useTreeNodeDnd — useDroppable 3 슬롯', () => {
  it('before 슬롯: tree-position + index 그대로', () => {
    renderHook(() => useTreeNodeDnd(baseArgs))
    const before = dnd.droppableCalls.find((c) => c.id.startsWith('tree-before:'))
    expect(before).toBeDefined()
    expect(before?.id).toBe('tree-before:n-1')
    expect(before?.data).toMatchObject({ target: 'tree-position', parentId: 'f-1', index: 2 })
  })

  it('after 슬롯: tree-position + index + 1', () => {
    renderHook(() => useTreeNodeDnd(baseArgs))
    const after = dnd.droppableCalls.find((c) => c.id.startsWith('tree-after:'))
    expect(after?.id).toBe('tree-after:n-1')
    expect(after?.data).toMatchObject({ index: 3 })
  })

  it('into 슬롯: tree-into + folderId, polder=false 면 disabled', () => {
    renderHook(() => useTreeNodeDnd(baseArgs))
    const into = dnd.droppableCalls.find((c) => c.id.startsWith('tree-into:'))
    expect(into?.data).toMatchObject({ target: 'tree-into', folderId: 'n-1' })
    expect(into?.disabled).toBe(true) // isFolder=false → into 비활성
  })

  it('isFolder=true → into 슬롯 활성 (dropDisabled=false)', () => {
    renderHook(() => useTreeNodeDnd({ ...baseArgs, isFolder: true, kind: 'folder' }))
    const into = dnd.droppableCalls.find((c) => c.id.startsWith('tree-into:'))
    expect(into?.disabled).toBe(false)
  })
})

describe('useTreeNodeDnd — dropDisabled (isTreeDragActive=false)', () => {
  it('트리 드래그 비활성 → before/after/into 모두 disabled', () => {
    dnd.isTreeDragActive = false
    renderHook(() => useTreeNodeDnd({ ...baseArgs, isFolder: true }))
    expect(dnd.droppableCalls.every((c) => c.disabled === true)).toBe(true)
  })
})
