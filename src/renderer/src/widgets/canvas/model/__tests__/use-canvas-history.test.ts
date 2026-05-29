/**
 * widgets/canvas/model/use-canvas-history.test.ts
 *
 * useCanvasHistory hook: initHistory / pushHistory / undo / redo / canUndo / canRedo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@entities/canvas', () => ({
  toReactFlowNode: (n: Record<string, unknown>) => ({
    ...n,
    position: { x: 0, y: 0 },
    data: { ...n }
  }),
  toReactFlowEdge: (e: Record<string, unknown>) => ({ ...e, source: '', target: '' })
}))

import { useCanvasHistory } from '../use-canvas-history'

function makeStore(
  initialState: { nodes: Array<unknown>; edges: Array<unknown> } = { nodes: [], edges: [] }
): {
  store: ReturnType<typeof createStore>
  state: {
    nodes: Array<{ id: string; data: Record<string, unknown>; position: { x: number; y: number } }>
    edges: Array<{ id: string; data: Record<string, unknown> }>
    setNodes: (n: unknown[]) => void
    setEdges: (e: unknown[]) => void
  }
}

function createStore(initial: {
  nodes: Array<{
    id: string
    data: Record<string, unknown>
    position: { x: number; y: number }
    zIndex?: number
  }>
  edges: Array<{
    id: string
    data: Record<string, unknown>
    source: string
    target: string
    label?: string | null
  }>
}): unknown {
  let nodes = initial.nodes
  let edges = initial.edges
  return {
    getState: () => ({
      nodes,
      edges,
      setNodes: (n: unknown[]) => {
        nodes = n as typeof nodes
      },
      setEdges: (e: unknown[]) => {
        edges = e as typeof edges
      }
    }),
    subscribe: () => () => {},
    setState: vi.fn(),
    destroy: vi.fn()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCanvasHistory', () => {
  it('초기 상태 canUndo=false, canRedo=false', () => {
    const store = createStore({ nodes: [], edges: [] }) as Parameters<typeof useCanvasHistory>[1]
    const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
      typeof useCanvasHistory
    >[2]
    const skipRef = { current: false }
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('initHistory → 첫 스냅샷 저장 (canUndo=false 유지)', () => {
    const store = createStore({ nodes: [], edges: [] }) as Parameters<typeof useCanvasHistory>[1]
    const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
      typeof useCanvasHistory
    >[2]
    const skipRef = { current: false }
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef))
    act(() => {
      result.current.initHistory()
    })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('pushHistory 호출 후 canUndo=true', () => {
    const store = createStore({ nodes: [], edges: [] }) as Parameters<typeof useCanvasHistory>[1]
    const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
      typeof useCanvasHistory
    >[2]
    const skipRef = { current: false }
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef))
    act(() => {
      result.current.initHistory()
      result.current.pushHistory()
    })
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('undo → canUndo=false, canRedo=true', async () => {
    const store = createStore({ nodes: [], edges: [] }) as Parameters<typeof useCanvasHistory>[1]
    const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
      typeof useCanvasHistory
    >[2]
    const skipRef = { current: false }
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef))
    act(() => {
      result.current.initHistory()
      result.current.pushHistory()
    })
    await act(async () => {
      await result.current.undo()
    })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('초기 상태에서 undo → 무시 (canUndo=false)', async () => {
    const store = createStore({ nodes: [], edges: [] }) as Parameters<typeof useCanvasHistory>[1]
    const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
      typeof useCanvasHistory
    >[2]
    const skipRef = { current: false }
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef))
    await act(async () => {
      await result.current.undo()
    })
    expect(result.current.canUndo).toBe(false)
  })

  it('redo 가능 시 → 다시 canUndo=true', async () => {
    const store = createStore({ nodes: [], edges: [] }) as Parameters<typeof useCanvasHistory>[1]
    const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
      typeof useCanvasHistory
    >[2]
    const skipRef = { current: false }
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef))
    act(() => {
      result.current.initHistory()
      result.current.pushHistory()
    })
    await act(async () => {
      await result.current.undo()
    })
    await act(async () => {
      await result.current.redo()
    })
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })
})
