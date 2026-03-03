import { useEffect, type MutableRefObject } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import { useCanvasNodes, useCanvasEdges, toReactFlowNode, toReactFlowEdge } from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'

export function useCanvasHydration(
  canvasId: string,
  store: StoreApi<CanvasFlowState>,
  hydratedRef: MutableRefObject<boolean>
) {
  const { data: dbNodes = [], isLoading: nodesLoading } = useCanvasNodes(canvasId)
  const { data: dbEdges = [], isLoading: edgesLoading } = useCanvasEdges(canvasId)

  const isLoading = nodesLoading || edgesLoading

  // 1) Initial hydration — 최초 1회
  useEffect(() => {
    if (isLoading || hydratedRef.current) return
    hydratedRef.current = true
    store.getState().setNodes(dbNodes.map(toReactFlowNode))
    store.getState().setEdges(dbEdges.map(toReactFlowEdge))
    store.getState().setHydrated(true)
  }, [isLoading, dbNodes, dbEdges, store, hydratedRef])

  // 2) Node sync — mutation 후 ID 집합 비교로 추가/삭제만 반영
  useEffect(() => {
    if (!hydratedRef.current) return
    const storeIds = new Set(store.getState().nodes.map((n) => n.id))
    const dbIds = new Set(dbNodes.map((n) => n.id))
    if (storeIds.size !== dbIds.size || dbNodes.some((n) => !storeIds.has(n.id))) {
      store.getState().setNodes(dbNodes.map(toReactFlowNode))
    }
  }, [dbNodes, store, hydratedRef])

  // 3) Edge sync — 동일 전략
  useEffect(() => {
    if (!hydratedRef.current) return
    const storeIds = new Set(store.getState().edges.map((e) => e.id))
    const dbIds = new Set(dbEdges.map((e) => e.id))
    if (storeIds.size !== dbIds.size || dbEdges.some((e) => !storeIds.has(e.id))) {
      store.getState().setEdges(dbEdges.map(toReactFlowEdge))
    }
  }, [dbEdges, store, hydratedRef])

  return { isLoading }
}
