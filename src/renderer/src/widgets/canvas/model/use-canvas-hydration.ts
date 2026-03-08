import { useEffect, type MutableRefObject } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import {
  useCanvasNodes,
  useCanvasEdges,
  toReactFlowNode,
  toReactFlowEdge,
  type CanvasNodeItem
} from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'
import type { CanvasNode } from '@entities/canvas'

/** DB 노드 데이터가 store 노드와 다른지 비교 (position 제외, data만) */
function hasDataChanged(storeNode: CanvasNode, dbItem: CanvasNodeItem): boolean {
  return (
    storeNode.data.content !== dbItem.content ||
    storeNode.data.color !== dbItem.color ||
    storeNode.data.width !== dbItem.width ||
    storeNode.data.height !== dbItem.height ||
    (storeNode.zIndex ?? 0) !== dbItem.zIndex
  )
}

export function useCanvasHydration(
  canvasId: string,
  store: StoreApi<CanvasFlowState>,
  hydratedRef: MutableRefObject<boolean>,
  skipHydrationRef: MutableRefObject<boolean>,
  initHistory?: () => void
): { isLoading: boolean } {
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
    initHistory?.()
  }, [isLoading, dbNodes, dbEdges, store, hydratedRef, initHistory])

  // 2) Node sync — ID 변경(추가/삭제) 또는 data 변경(content, color 등) 반영
  useEffect(() => {
    if (!hydratedRef.current || skipHydrationRef.current) return
    const storeNodes = store.getState().nodes
    const storeIds = new Set(storeNodes.map((n) => n.id))
    const dbIds = new Set(dbNodes.map((n) => n.id))

    // ID set changed (structural add/remove) → full replacement
    if (storeIds.size !== dbIds.size || dbNodes.some((n) => !storeIds.has(n.id))) {
      store.getState().setNodes(dbNodes.map(toReactFlowNode))
      return
    }

    // Same IDs → merge data changes while preserving position/selection
    const dbMap = new Map(dbNodes.map((n) => [n.id, n]))
    let dirty = false
    const merged = storeNodes.map((node) => {
      const dbItem = dbMap.get(node.id)
      if (!dbItem || !hasDataChanged(node, dbItem)) return node
      dirty = true
      const fresh = toReactFlowNode(dbItem)
      // Preserve ReactFlow-managed state (position, selected, dragging, etc.)
      return { ...node, data: fresh.data, style: fresh.style, zIndex: fresh.zIndex }
    })
    if (dirty) {
      store.getState().setNodes(merged as CanvasNode[])
    }
  }, [dbNodes, store, hydratedRef, skipHydrationRef])

  // 3) Edge sync — 동일 전략
  useEffect(() => {
    if (!hydratedRef.current || skipHydrationRef.current) return
    const storeIds = new Set(store.getState().edges.map((e) => e.id))
    const dbIds = new Set(dbEdges.map((e) => e.id))
    if (storeIds.size !== dbIds.size || dbEdges.some((e) => !storeIds.has(e.id))) {
      store.getState().setEdges(dbEdges.map(toReactFlowEdge))
    }
  }, [dbEdges, store, hydratedRef, skipHydrationRef])

  return { isLoading }
}
