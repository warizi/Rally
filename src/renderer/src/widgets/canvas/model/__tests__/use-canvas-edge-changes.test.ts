/**
 * widgets/canvas/model/use-canvas-edge-changes.test.ts
 *
 * EdgeChange remove → removeEdge + pushHistory. onConnect → createEdge.
 * source/target 누락 connection → no-op.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { EdgeChange, Connection } from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'

const mocks = vi.hoisted(() => ({
  createEdge: vi.fn(),
  removeEdge: vi.fn(),
  toCreateCanvasEdgeData: vi.fn((c: Connection) => ({ from: c.source, to: c.target }))
}))

vi.mock('@entities/canvas', () => ({
  useCreateCanvasEdge: () => ({ mutate: mocks.createEdge }),
  useRemoveCanvasEdge: () => ({ mutate: mocks.removeEdge }),
  toCreateCanvasEdgeData: mocks.toCreateCanvasEdgeData
}))

import { useCanvasEdgeChanges } from '../use-canvas-edge-changes'
import type { CanvasFlowState } from '../use-canvas-store'

function makeStore(): { store: StoreApi<CanvasFlowState>; applyCalls: EdgeChange[][] } {
  const applyCalls: EdgeChange[][] = []
  const store = {
    getState: () => ({
      applyEdgeChanges: (changes: EdgeChange[]) => applyCalls.push(changes)
    })
  } as unknown as StoreApi<CanvasFlowState>
  return { store, applyCalls }
}

beforeEach(() => {
  mocks.createEdge.mockClear()
  mocks.removeEdge.mockClear()
  mocks.toCreateCanvasEdgeData.mockClear()
})

describe('useCanvasEdgeChanges — onEdgesChange', () => {
  it('빈 changes → store.applyEdgeChanges 만, removeEdge 안 부름', () => {
    const { store, applyCalls } = makeStore()
    const pushHistory = vi.fn()
    const { result } = renderHook(() => useCanvasEdgeChanges('cv', store, pushHistory))
    act(() => result.current.onEdgesChange([]))
    expect(applyCalls).toEqual([[]])
    expect(mocks.removeEdge).not.toHaveBeenCalled()
    expect(pushHistory).not.toHaveBeenCalled()
  })

  it('remove change → pushHistory + removeEdge', () => {
    const { store } = makeStore()
    const pushHistory = vi.fn()
    const { result } = renderHook(() => useCanvasEdgeChanges('cv', store, pushHistory))
    act(() => result.current.onEdgesChange([{ type: 'remove', id: 'e1' }]))
    expect(pushHistory).toHaveBeenCalled()
    expect(mocks.removeEdge).toHaveBeenCalledWith({ edgeId: 'e1', canvasId: 'cv' })
  })

  it('여러 remove → 각각 호출', () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useCanvasEdgeChanges('cv', store))
    act(() =>
      result.current.onEdgesChange([
        { type: 'remove', id: 'a' },
        { type: 'remove', id: 'b' }
      ])
    )
    expect(mocks.removeEdge).toHaveBeenCalledTimes(2)
  })
})

describe('useCanvasEdgeChanges — onConnect', () => {
  it('source/target 모두 있음 → createEdge + pushHistory', () => {
    const { store } = makeStore()
    const pushHistory = vi.fn()
    const { result } = renderHook(() => useCanvasEdgeChanges('cv', store, pushHistory))
    act(() =>
      result.current.onConnect({
        source: 'a',
        target: 'b',
        sourceHandle: null,
        targetHandle: null
      } as Connection)
    )
    expect(mocks.toCreateCanvasEdgeData).toHaveBeenCalled()
    expect(mocks.createEdge).toHaveBeenCalledWith({
      canvasId: 'cv',
      data: { from: 'a', to: 'b' }
    })
    expect(pushHistory).toHaveBeenCalled()
  })

  it('source 누락 → no-op', () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useCanvasEdgeChanges('cv', store))
    act(() =>
      result.current.onConnect({
        source: null,
        target: 'b',
        sourceHandle: null,
        targetHandle: null
      } as unknown as Connection)
    )
    expect(mocks.createEdge).not.toHaveBeenCalled()
  })

  it('target 누락 → no-op', () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useCanvasEdgeChanges('cv', store))
    act(() =>
      result.current.onConnect({
        source: 'a',
        target: null,
        sourceHandle: null,
        targetHandle: null
      } as unknown as Connection)
    )
    expect(mocks.createEdge).not.toHaveBeenCalled()
  })
})
