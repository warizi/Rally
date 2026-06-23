/**
 * widgets/canvas/model/use-canvas-history.test.ts
 *
 * useCanvasHistory hook: initHistory / pushHistory / undo / redo / canUndo / canRedo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element =>
  createElement(QueryClientProvider, { client: qc }, children)

vi.mock('@entities/canvas', () => ({
  toReactFlowNode: (n: Record<string, unknown>) => ({
    ...n,
    position: { x: 0, y: 0 },
    data: { ...n }
  }),
  toReactFlowGroupNode: (g: Record<string, unknown>) => ({
    ...g,
    type: 'groupNode',
    position: { x: 0, y: 0 },
    data: { ...g }
  }),
  toReactFlowEdge: (e: Record<string, unknown>) => ({ ...e, source: '', target: '' }),
  assignGroupZIndexByDepth: () => {}
}))

import { useCanvasHistory } from '../use-canvas-history'

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
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef), {
      wrapper
    })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('initHistory → 첫 스냅샷 저장 (canUndo=false 유지)', () => {
    const store = createStore({ nodes: [], edges: [] }) as Parameters<typeof useCanvasHistory>[1]
    const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
      typeof useCanvasHistory
    >[2]
    const skipRef = { current: false }
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef), {
      wrapper
    })
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
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef), {
      wrapper
    })
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
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef), {
      wrapper
    })
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
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef), {
      wrapper
    })
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
    const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef), {
      wrapper
    })
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

// ── 중앙집중 auto-capture: store 변경 구독 → 디바운스 스냅샷 ──
type NotifyNode = {
  id: string
  type: string
  position: { x: number; y: number }
  zIndex: number
  dragging?: boolean
  data: { nodeType: string; width: number; height: number; color: string | null; content: string }
}

function makeNode(id: string, color: string | null, dragging = false): NotifyNode {
  return {
    id,
    type: 'textNode',
    position: { x: 0, y: 0 },
    zIndex: 0,
    dragging,
    data: { nodeType: 'text', width: 10, height: 10, color, content: '' }
  }
}

function makeNotifyingStore(initial: NotifyNode[]): unknown {
  let nodes = initial
  let edges: unknown[] = []
  const listeners = new Set<() => void>()
  const notify = (): void => listeners.forEach((l) => l())
  return {
    getState: () => ({
      nodes,
      edges,
      setNodes: (n: unknown[]) => {
        nodes = n as NotifyNode[]
        notify()
      },
      setEdges: (e: unknown[]) => {
        edges = e
        notify()
      }
    }),
    subscribe: (l: () => void) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    setState: vi.fn(),
    destroy: vi.fn()
  }
}

describe('useCanvasHistory — auto-capture', () => {
  it('color 변경(수동 pushHistory 없이) → 디바운스 후 자동 스냅샷', () => {
    vi.useFakeTimers()
    try {
      const store = makeNotifyingStore([makeNode('n1', null)]) as Parameters<
        typeof useCanvasHistory
      >[1]
      const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
        typeof useCanvasHistory
      >[2]
      const skipRef = { current: false }
      const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef), {
        wrapper
      })
      act(() => result.current.initHistory())
      expect(result.current.canUndo).toBe(false)

      // 색 변경 = setNodes (수동 pushHistory 호출 없음)
      act(() => (store.getState().setNodes as (n: unknown[]) => void)([makeNode('n1', '#ff0000')]))
      // 디바운스 전 → 아직 미캡처
      expect(result.current.canUndo).toBe(false)
      act(() => vi.advanceTimersByTime(300))
      expect(result.current.canUndo).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('selection 만 바뀌면(데이터 동일) 스냅샷 안 함', () => {
    vi.useFakeTimers()
    try {
      const store = makeNotifyingStore([makeNode('n1', null)]) as Parameters<
        typeof useCanvasHistory
      >[1]
      const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
        typeof useCanvasHistory
      >[2]
      const skipRef = { current: false }
      const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef), {
        wrapper
      })
      act(() => result.current.initHistory())
      // selected 토글만 — captureSnapshot 지문은 동일
      act(() =>
        (store.getState().setNodes as (n: unknown[]) => void)([
          { ...makeNode('n1', null), selected: true }
        ])
      )
      act(() => vi.advanceTimersByTime(300))
      expect(result.current.canUndo).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('드래그 중(dragging=true)에는 스냅샷 안 함', () => {
    vi.useFakeTimers()
    try {
      const store = makeNotifyingStore([makeNode('n1', null)]) as Parameters<
        typeof useCanvasHistory
      >[1]
      const syncMutation = { mutateAsync: vi.fn() } as unknown as Parameters<
        typeof useCanvasHistory
      >[2]
      const skipRef = { current: false }
      const { result } = renderHook(() => useCanvasHistory('c1', store, syncMutation, skipRef), {
        wrapper
      })
      act(() => result.current.initHistory())
      // 위치 변경이지만 dragging 중 → 캡처 보류
      act(() =>
        (store.getState().setNodes as (n: unknown[]) => void)([
          { ...makeNode('n1', '#00ff00', true) }
        ])
      )
      act(() => vi.advanceTimersByTime(300))
      expect(result.current.canUndo).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
