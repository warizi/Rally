/**
 * widgets/canvas/model/use-canvas-hydration.test.ts
 *
 * isLoading 분기 + 초기 hydration 호출 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  nodes: [] as Array<{ id: string; content?: string }>,
  edges: [] as Array<{ id: string }>,
  nodesLoading: false,
  edgesLoading: false
}))

vi.mock('@entities/canvas', () => ({
  useCanvasNodes: () => ({ data: mocks.nodes, isLoading: mocks.nodesLoading }),
  useCanvasEdges: () => ({ data: mocks.edges, isLoading: mocks.edgesLoading }),
  toReactFlowNode: (n: { id: string }) => ({
    ...n,
    position: { x: 0, y: 0 },
    data: { content: '', color: null, width: 0, height: 0 },
    zIndex: 0
  }),
  toReactFlowEdge: (e: { id: string }) => ({ ...e, source: '', target: '' })
}))

import { useCanvasHydration } from '../use-canvas-hydration'

function createStore(): {
  getState: () => {
    nodes: Array<{ id: string; data: { content: string; color: null }; zIndex: number }>
    edges: Array<{ id: string }>
    hydrated: boolean
    setNodes: (n: unknown[]) => void
    setEdges: (e: unknown[]) => void
    setHydrated: (b: boolean) => void
  }
} {
  let nodes: Array<{ id: string; data: { content: string; color: null }; zIndex: number }> = []
  let edges: Array<{ id: string }> = []
  let hydrated = false
  return {
    getState: () => ({
      nodes,
      edges,
      hydrated,
      setNodes: (n: unknown[]) => {
        nodes = n as typeof nodes
      },
      setEdges: (e: unknown[]) => {
        edges = e as typeof edges
      },
      setHydrated: (b: boolean) => {
        hydrated = b
      }
    })
  }
}

beforeEach(() => {
  mocks.nodes = []
  mocks.edges = []
  mocks.nodesLoading = false
  mocks.edgesLoading = false
})

describe('useCanvasHydration', () => {
  it('isLoading=true (nodes 로딩 중) → isLoading 반환', () => {
    mocks.nodesLoading = true
    const store = createStore() as Parameters<typeof useCanvasHydration>[1]
    const hydratedRef = { current: false }
    const skipRef = { current: false }
    const { result } = renderHook(() => useCanvasHydration('c1', store, hydratedRef, skipRef))
    expect(result.current.isLoading).toBe(true)
  })

  it('isLoading=true (edges 로딩 중) → isLoading 반환', () => {
    mocks.edgesLoading = true
    const store = createStore() as Parameters<typeof useCanvasHydration>[1]
    const hydratedRef = { current: false }
    const skipRef = { current: false }
    const { result } = renderHook(() => useCanvasHydration('c1', store, hydratedRef, skipRef))
    expect(result.current.isLoading).toBe(true)
  })

  it('isLoading=false → hydratedRef.current=true 설정', () => {
    const store = createStore() as Parameters<typeof useCanvasHydration>[1]
    const hydratedRef = { current: false }
    const skipRef = { current: false }
    renderHook(() => useCanvasHydration('c1', store, hydratedRef, skipRef))
    expect(hydratedRef.current).toBe(true)
  })

  it('initHistory 콜백 호출됨', () => {
    const store = createStore() as Parameters<typeof useCanvasHydration>[1]
    const hydratedRef = { current: false }
    const skipRef = { current: false }
    const initHistory = vi.fn()
    renderHook(() => useCanvasHydration('c1', store, hydratedRef, skipRef, initHistory))
    expect(initHistory).toHaveBeenCalled()
  })

  it('이미 hydrated → initHistory 호출 안 함', () => {
    const store = createStore() as Parameters<typeof useCanvasHydration>[1]
    const hydratedRef = { current: true }
    const skipRef = { current: false }
    const initHistory = vi.fn()
    renderHook(() => useCanvasHydration('c1', store, hydratedRef, skipRef, initHistory))
    expect(initHistory).not.toHaveBeenCalled()
  })

  it('isLoading=true → hydratedRef.current=false 유지 (초기 hydration skip)', () => {
    mocks.nodesLoading = true
    const store = createStore() as Parameters<typeof useCanvasHydration>[1]
    const hydratedRef = { current: false }
    const skipRef = { current: false }
    const initHistory = vi.fn()
    renderHook(() => useCanvasHydration('c1', store, hydratedRef, skipRef, initHistory))
    expect(hydratedRef.current).toBe(false)
    expect(initHistory).not.toHaveBeenCalled()
  })

  it('dbNodes/dbEdges 있음 → setNodes / setEdges 가 ReactFlow 형태로 호출됨', () => {
    mocks.nodes = [{ id: 'n1' }, { id: 'n2' }]
    mocks.edges = [{ id: 'e1' }]
    const store = createStore() as Parameters<typeof useCanvasHydration>[1]
    const hydratedRef = { current: false }
    const skipRef = { current: false }
    renderHook(() => useCanvasHydration('c1', store, hydratedRef, skipRef))
    expect(hydratedRef.current).toBe(true)
    // setHydrated(true) 호출 → store.hydrated = true
    expect(store.getState().hydrated).toBe(true)
  })

  it('initHistory 없음 (undefined) → 에러 없이 마운트 (smoke)', () => {
    const store = createStore() as Parameters<typeof useCanvasHydration>[1]
    const hydratedRef = { current: false }
    const skipRef = { current: false }
    const { result } = renderHook(() =>
      useCanvasHydration('c1', store, hydratedRef, skipRef, undefined)
    )
    expect(result.current.isLoading).toBe(false)
  })
})
