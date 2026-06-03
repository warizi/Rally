/**
 * widgets/canvas/model/use-canvas-node-changes.test.ts
 *
 * NodeChange 처리 — position(dragging=false) → updatePositions,
 * dimensions(resizing=false) → updateNode, remove → removeNode + pushHistory.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { NodeChange } from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'

const mocks = vi.hoisted(() => ({
  updateNode: vi.fn(),
  updatePositions: vi.fn(),
  removeNode: vi.fn(),
  updateGroup: vi.fn(),
  removeGroup: vi.fn()
}))

vi.mock('@entities/canvas', () => ({
  useUpdateCanvasNode: () => ({ mutate: mocks.updateNode }),
  useUpdateCanvasNodePositions: () => ({ mutate: mocks.updatePositions }),
  useRemoveCanvasNode: () => ({ mutate: mocks.removeNode }),
  useUpdateCanvasGroup: () => ({ mutate: mocks.updateGroup }),
  useRemoveCanvasGroup: () => ({ mutate: mocks.removeGroup })
}))

import { useCanvasNodeChanges } from '../use-canvas-node-changes'
import type { CanvasFlowState } from '../use-canvas-store'

function makeStore(): { store: StoreApi<CanvasFlowState>; applyCalls: NodeChange[][] } {
  const applyCalls: NodeChange[][] = []
  const store = {
    getState: () => ({
      nodes: [],
      applyNodeChanges: (changes: NodeChange[]) => applyCalls.push(changes),
      setNodes: vi.fn()
    })
  } as unknown as StoreApi<CanvasFlowState>
  return { store, applyCalls }
}

beforeEach(() => {
  mocks.updateNode.mockClear()
  mocks.updatePositions.mockClear()
  mocks.removeNode.mockClear()
  mocks.updateGroup.mockClear()
  mocks.removeGroup.mockClear()
})

describe('useCanvasNodeChanges', () => {
  it('빈 changes → store.applyNodeChanges 만 호출, mutation 안 부름', () => {
    const { store, applyCalls } = makeStore()
    const pushHistory = vi.fn()
    const { result } = renderHook(() => useCanvasNodeChanges('cv-1', store, pushHistory))
    act(() => result.current.onNodesChange([]))
    expect(applyCalls).toEqual([[]])
    expect(mocks.updateNode).not.toHaveBeenCalled()
    expect(mocks.updatePositions).not.toHaveBeenCalled()
    expect(mocks.removeNode).not.toHaveBeenCalled()
    expect(pushHistory).not.toHaveBeenCalled()
  })

  it('position change (dragging=false) → updatePositions + pushHistory', () => {
    const { store } = makeStore()
    const pushHistory = vi.fn()
    const { result } = renderHook(() => useCanvasNodeChanges('cv-1', store, pushHistory))
    const ch: NodeChange = {
      type: 'position',
      id: 'n1',
      position: { x: 10, y: 20 },
      dragging: false
    } as unknown as NodeChange
    act(() => result.current.onNodesChange([ch]))
    expect(mocks.updatePositions).toHaveBeenCalledWith({
      updates: [{ id: 'n1', x: 10, y: 20 }],
      canvasId: 'cv-1'
    })
    expect(pushHistory).toHaveBeenCalled()
  })

  it('position change (dragging=true) → updatePositions 호출 안 함', () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useCanvasNodeChanges('cv-1', store))
    const ch: NodeChange = {
      type: 'position',
      id: 'n1',
      position: { x: 1, y: 2 },
      dragging: true
    } as unknown as NodeChange
    act(() => result.current.onNodesChange([ch]))
    expect(mocks.updatePositions).not.toHaveBeenCalled()
  })

  it('dimensions change (resizing=false) → updateNode', () => {
    const { store } = makeStore()
    const pushHistory = vi.fn()
    const { result } = renderHook(() => useCanvasNodeChanges('cv-1', store, pushHistory))
    const ch: NodeChange = {
      type: 'dimensions',
      id: 'n1',
      dimensions: { width: 200, height: 150 },
      resizing: false
    } as unknown as NodeChange
    act(() => result.current.onNodesChange([ch]))
    expect(mocks.updateNode).toHaveBeenCalledWith({
      nodeId: 'n1',
      data: { width: 200, height: 150 },
      canvasId: 'cv-1'
    })
    expect(pushHistory).toHaveBeenCalled()
  })

  it('dimensions change (resizing=true) → updateNode 안 부름', () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useCanvasNodeChanges('cv-1', store))
    const ch: NodeChange = {
      type: 'dimensions',
      id: 'n1',
      dimensions: { width: 1, height: 1 },
      resizing: true
    } as unknown as NodeChange
    act(() => result.current.onNodesChange([ch]))
    expect(mocks.updateNode).not.toHaveBeenCalled()
  })

  it('remove → pushHistory (선행) + removeNode', () => {
    const { store } = makeStore()
    const pushHistory = vi.fn()
    const { result } = renderHook(() => useCanvasNodeChanges('cv-1', store, pushHistory))
    const ch: NodeChange = { type: 'remove', id: 'n1' }
    act(() => result.current.onNodesChange([ch]))
    expect(pushHistory).toHaveBeenCalled()
    expect(mocks.removeNode).toHaveBeenCalledWith({ nodeId: 'n1', canvasId: 'cv-1' })
  })

  it('여러 remove → 각각 removeNode 호출', () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useCanvasNodeChanges('cv-1', store))
    act(() =>
      result.current.onNodesChange([
        { type: 'remove', id: 'a' },
        { type: 'remove', id: 'b' }
      ])
    )
    expect(mocks.removeNode).toHaveBeenCalledTimes(2)
  })
})
