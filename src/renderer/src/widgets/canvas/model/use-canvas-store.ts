import { useMemo, useEffect, useRef } from 'react'
import type { NodeChange, EdgeChange } from '@xyflow/react'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import type { CanvasNode, CanvasEdge } from '@entities/canvas'

// ─── Store Interface ────────────────────────────────────

export interface CanvasFlowState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  hydrated: boolean
  setNodes: (nodes: CanvasNode[]) => void
  setEdges: (edges: CanvasEdge[]) => void
  applyNodeChanges: (changes: NodeChange[]) => void
  applyEdgeChanges: (changes: EdgeChange[]) => void
  setHydrated: (v: boolean) => void
  reset: () => void
}

// ─── Per-canvas Store Map ───────────────────────────────

const storeMap = new Map<string, StoreApi<CanvasFlowState>>()

function getOrCreateStore(canvasId: string): StoreApi<CanvasFlowState> {
  let store = storeMap.get(canvasId)
  if (!store) {
    store = createStore<CanvasFlowState>((set) => ({
      nodes: [],
      edges: [],
      hydrated: false,
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      applyNodeChanges: (changes) =>
        set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as CanvasNode[] })),
      applyEdgeChanges: (changes) =>
        set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as CanvasEdge[] })),
      setHydrated: (hydrated) => set({ hydrated }),
      reset: () => set({ nodes: [], edges: [], hydrated: false })
    }))
    storeMap.set(canvasId, store)
  }
  return store
}

// ─── Hook ───────────────────────────────────────────────

export function useCanvasStore(canvasId: string) {
  const store = useMemo(() => getOrCreateStore(canvasId), [canvasId])
  const nodes = useStore(store, (s) => s.nodes)
  const edges = useStore(store, (s) => s.edges)
  const hydrated = useStore(store, (s) => s.hydrated)

  const hydratedRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      store.getState().reset()
      storeMap.delete(canvasId)
      hydratedRef.current = false
    }
  }, [store, canvasId])

  return { store, nodes, edges, hydrated, hydratedRef }
}
