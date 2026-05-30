/**
 * widgets/canvas/model/use-canvas-data.test.tsx
 *
 * useCanvasData composes 여러 sub-hook (이미 각자 테스트됨). 여기선 통합 hook 의
 * 반환 인터페이스 + viewport 우선순위 (searchParams > DB > default) + addTextNode /
 * addRefNode 가 createNode 를 올바른 데이터로 호출하는지 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  createNode: vi.fn(),
  createNodeAsync: vi.fn(),
  createEdgeAsync: vi.fn(),
  updateNode: vi.fn(),
  updateEdge: vi.fn(),
  updateViewport: vi.fn(),
  canvasData: { viewportX: 100, viewportY: 200, viewportZoom: 1.5 } as
    | { viewportX: number; viewportY: number; viewportZoom: number }
    | undefined,
  tabSearchParams: undefined as Record<string, string> | undefined,
  navigateTab: vi.fn(),
  syncStateMutation: { mutateAsync: vi.fn() },
  store: { getState: () => ({}), subscribe: vi.fn() }
}))

vi.mock('@entities/canvas', () => ({
  useCanvasById: () => ({ data: mocks.canvasData }),
  useCreateCanvasNode: () => ({ mutate: mocks.createNode, mutateAsync: mocks.createNodeAsync }),
  useCreateCanvasEdge: () => ({ mutate: vi.fn(), mutateAsync: mocks.createEdgeAsync }),
  useUpdateCanvasNode: () => ({ mutate: mocks.updateNode }),
  useUpdateCanvasEdge: () => ({ mutate: mocks.updateEdge }),
  useUpdateCanvasViewport: () => ({ mutate: mocks.updateViewport }),
  useSyncCanvasState: () => mocks.syncStateMutation
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        tabs: {
          'tab-1': { searchParams: mocks.tabSearchParams }
        },
        navigateTab: mocks.navigateTab
      }),
    {
      getState: () => ({
        tabs: {
          'tab-1': { searchParams: mocks.tabSearchParams }
        }
      })
    }
  )
}))

vi.mock('../use-canvas-store', () => ({
  useCanvasStore: () => ({
    store: mocks.store,
    nodes: [],
    edges: [],
    hydrated: true,
    hydratedRef: { current: true }
  })
}))

vi.mock('../use-canvas-hydration', () => ({
  useCanvasHydration: () => ({ isLoading: false })
}))

vi.mock('../use-canvas-node-changes', () => ({
  useCanvasNodeChanges: () => ({ onNodesChange: vi.fn() })
}))

vi.mock('../use-canvas-edge-changes', () => ({
  useCanvasEdgeChanges: () => ({ onEdgesChange: vi.fn(), onConnect: vi.fn() })
}))

vi.mock('../use-canvas-history', () => ({
  useCanvasHistory: () => ({
    pushHistory: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: true,
    canRedo: false,
    initHistory: vi.fn()
  })
}))

vi.mock('../node-type-registry', () => ({
  NODE_TYPE_REGISTRY: {
    text: { defaultWidth: 260, defaultHeight: 160 },
    todo: { defaultWidth: 300, defaultHeight: 200 }
  }
}))

import { useCanvasData } from '../use-canvas-data'

beforeEach(() => {
  mocks.createNode.mockReset()
  mocks.updateViewport.mockReset()
  mocks.navigateTab.mockReset()
  mocks.tabSearchParams = undefined
  mocks.canvasData = { viewportX: 100, viewportY: 200, viewportZoom: 1.5 }
})

describe('useCanvasData', () => {
  it('viewport: tabSearchParams 가 있으면 그 값 우선', () => {
    mocks.tabSearchParams = { vx: '50', vy: '60', vz: '2' }
    const { result } = renderHook(() => useCanvasData('c1', 'tab-1'))
    expect(result.current.defaultViewport).toEqual({ x: 50, y: 60, zoom: 2 })
    expect(result.current.hasSavedViewport).toBe(true)
  })

  it('viewport: searchParams 없으면 DB canvas 데이터', () => {
    const { result } = renderHook(() => useCanvasData('c1', 'tab-1'))
    expect(result.current.defaultViewport).toEqual({ x: 100, y: 200, zoom: 1.5 })
    expect(result.current.hasSavedViewport).toBe(false)
  })

  it('viewport: DB 없으면 fallback (0, 0, 1)', () => {
    mocks.canvasData = undefined
    const { result } = renderHook(() => useCanvasData('c1'))
    expect(result.current.defaultViewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('addTextNode → createNode 호출 (type=text, default 260x160)', () => {
    const { result } = renderHook(() => useCanvasData('c1'))
    act(() => {
      result.current.addTextNode(10, 20)
    })
    expect(mocks.createNode).toHaveBeenCalledTimes(1)
    expect(mocks.createNode.mock.calls[0][0]).toEqual({
      canvasId: 'c1',
      data: { type: 'text', x: 10, y: 20, width: 260, height: 160 }
    })
  })

  it('addRefNode → createNode 호출 (NODE_TYPE_REGISTRY config 적용)', () => {
    const { result } = renderHook(() => useCanvasData('c1'))
    act(() => {
      result.current.addRefNode('todo', 'todo-1', 30, 40)
    })
    expect(mocks.createNode).toHaveBeenCalledWith({
      canvasId: 'c1',
      data: { type: 'todo', refId: 'todo-1', x: 30, y: 40, width: 300, height: 200 }
    })
  })

  it('saveViewport → updateViewport + navigateTab (tabId 있을 때)', () => {
    const { result } = renderHook(() => useCanvasData('c1', 'tab-1'))
    act(() => {
      result.current.saveViewport({ x: 5, y: 6, zoom: 1.2 })
    })
    expect(mocks.updateViewport).toHaveBeenCalledWith({
      canvasId: 'c1',
      viewport: { x: 5, y: 6, zoom: 1.2 }
    })
    expect(mocks.navigateTab).toHaveBeenCalled()
  })

  it('saveViewport → tabId 없으면 navigateTab 안 호출', () => {
    const { result } = renderHook(() => useCanvasData('c1'))
    act(() => {
      result.current.saveViewport({ x: 5, y: 6, zoom: 1 })
    })
    expect(mocks.updateViewport).toHaveBeenCalled()
    expect(mocks.navigateTab).not.toHaveBeenCalled()
  })
})
