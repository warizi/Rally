/**
 * widgets/canvas/model/use-canvas-store.test.ts
 *
 * Per-canvas zustand store. canvasId 별 단일 인스턴스 + 같은 canvasId 면 동일 store
 * 반환 (memoize). unmount 시 store reset + Map 에서 삭제 (cleanup effect).
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { NodeChange, EdgeChange } from '@xyflow/react'
import { useCanvasStore } from '../use-canvas-store'
import type { CanvasNode, CanvasEdge } from '@entities/canvas'

function node(id: string, x = 0, y = 0): CanvasNode {
  return {
    id,
    type: 'textNode',
    position: { x, y },
    data: { nodeType: 'text', content: '', color: null, width: 100, height: 100 }
  } as unknown as CanvasNode
}

function edge(id: string, src: string, tgt: string): CanvasEdge {
  return {
    id,
    source: src,
    target: tgt,
    data: { fromSide: 'right', toSide: 'left' }
  } as unknown as CanvasEdge
}

describe('useCanvasStore', () => {
  it('초기 nodes/edges 빈 배열, hydrated=false', () => {
    const { result } = renderHook(() => useCanvasStore('cv-init'))
    expect(result.current.nodes).toEqual([])
    expect(result.current.edges).toEqual([])
    expect(result.current.hydrated).toBe(false)
    expect(result.current.hydratedRef.current).toBe(false)
  })

  it('setNodes / setEdges 가 React 구독에 반영', () => {
    const { result } = renderHook(() => useCanvasStore('cv-set'))
    act(() => {
      result.current.store.getState().setNodes([node('n1')])
      result.current.store.getState().setEdges([edge('e1', 'a', 'b')])
    })
    expect(result.current.nodes.map((n) => n.id)).toEqual(['n1'])
    expect(result.current.edges.map((e) => e.id)).toEqual(['e1'])
  })

  it('setHydrated 가 반영', () => {
    const { result } = renderHook(() => useCanvasStore('cv-hyd'))
    act(() => {
      result.current.store.getState().setHydrated(true)
    })
    expect(result.current.hydrated).toBe(true)
  })

  it('applyNodeChanges (remove) → 노드 삭제', () => {
    const { result } = renderHook(() => useCanvasStore('cv-rm'))
    act(() => {
      result.current.store.getState().setNodes([node('a'), node('b')])
    })
    act(() => {
      const ch: NodeChange[] = [{ type: 'remove', id: 'a' }]
      result.current.store.getState().applyNodeChanges(ch)
    })
    expect(result.current.nodes.map((n) => n.id)).toEqual(['b'])
  })

  it('applyEdgeChanges (remove) → 엣지 삭제', () => {
    const { result } = renderHook(() => useCanvasStore('cv-erm'))
    act(() => {
      result.current.store.getState().setEdges([edge('e1', 'a', 'b'), edge('e2', 'b', 'c')])
    })
    act(() => {
      const ch: EdgeChange[] = [{ type: 'remove', id: 'e1' }]
      result.current.store.getState().applyEdgeChanges(ch)
    })
    expect(result.current.edges.map((e) => e.id)).toEqual(['e2'])
  })

  it('reset → 빈 상태 + hydrated false', () => {
    const { result } = renderHook(() => useCanvasStore('cv-reset'))
    act(() => {
      result.current.store.getState().setNodes([node('x')])
      result.current.store.getState().setHydrated(true)
    })
    act(() => {
      result.current.store.getState().reset()
    })
    expect(result.current.nodes).toEqual([])
    expect(result.current.hydrated).toBe(false)
  })

  it('같은 canvasId 두 hook → 같은 store 인스턴스', () => {
    const { result: a } = renderHook(() => useCanvasStore('cv-share'))
    const { result: b } = renderHook(() => useCanvasStore('cv-share'))
    expect(a.current.store).toBe(b.current.store)
  })

  it('unmount → store reset (다음 mount 시 빈 상태)', () => {
    const { result, unmount } = renderHook(() => useCanvasStore('cv-unmount'))
    act(() => {
      result.current.store.getState().setNodes([node('a'), node('b')])
    })
    unmount()
    // 새 mount → 새 store (Map 에서 삭제됨)
    const { result: fresh } = renderHook(() => useCanvasStore('cv-unmount'))
    expect(fresh.current.nodes).toEqual([])
  })
})
