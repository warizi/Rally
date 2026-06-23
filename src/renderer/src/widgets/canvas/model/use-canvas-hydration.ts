import { useEffect, type MutableRefObject } from 'react'
import type { StoreApi } from 'zustand/vanilla'
import {
  useCanvasNodes,
  useCanvasEdges,
  useCanvasGroups,
  toReactFlowNode,
  toReactFlowGroupNode,
  toReactFlowEdge,
  type CanvasNodeItem,
  type CanvasGroupItem
} from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'
import type { CanvasFlowNode, CanvasEdge } from '@entities/canvas'

/**
 * 그룹(groupNode)과 일반 노드(text/ref)를 단일 배열로 합친다.
 * 그룹을 먼저 둬서 렌더 순서상 항상 뒤(아래)에 오도록 한다.
 */
function buildFlowNodes(nodes: CanvasNodeItem[], groups: CanvasGroupItem[]): CanvasFlowNode[] {
  return [...groups.map(toReactFlowGroupNode), ...nodes.map(toReactFlowNode)]
}

/** DB 데이터가 store 노드와 다른지 비교 (position/selection 제외, data + zIndex만) */
function hasFlowNodeChanged(storeNode: CanvasFlowNode, desired: CanvasFlowNode): boolean {
  if (storeNode.type !== desired.type) return true
  if ((storeNode.zIndex ?? 0) !== (desired.zIndex ?? 0)) return true
  return JSON.stringify(storeNode.data) !== JSON.stringify(desired.data)
}

/** edge 의 시각 속성(label/선유형/화살표/색/연결 등) 지문 — selection 같은 RF 상태는 제외 */
function edgeFingerprint(e: CanvasEdge): string {
  return JSON.stringify({
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    type: e.type ?? null,
    label: e.label ?? null,
    style: e.style ?? null,
    markerEnd: e.markerEnd ?? null,
    markerStart: e.markerStart ?? null,
    data: e.data ?? null
  })
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
  const { data: dbGroups = [], isLoading: groupsLoading } = useCanvasGroups(canvasId)

  const isLoading = nodesLoading || edgesLoading || groupsLoading

  // 1) Initial hydration — 최초 1회
  useEffect(() => {
    if (isLoading || hydratedRef.current) return
    hydratedRef.current = true
    store.getState().setNodes(buildFlowNodes(dbNodes, dbGroups))
    store.getState().setEdges(dbEdges.map(toReactFlowEdge))
    store.getState().setHydrated(true)
    initHistory?.()
  }, [isLoading, dbNodes, dbEdges, dbGroups, store, hydratedRef, initHistory])

  // 2) Node/Group sync — ID 변경(추가/삭제) 또는 data 변경 반영
  useEffect(() => {
    if (!hydratedRef.current || skipHydrationRef.current) return
    const storeNodes = store.getState().nodes
    const desired = buildFlowNodes(dbNodes, dbGroups)
    const storeIds = new Set(storeNodes.map((n) => n.id))
    const desiredIds = new Set(desired.map((n) => n.id))

    // ID set changed (structural add/remove) → full replacement
    if (storeIds.size !== desiredIds.size || desired.some((n) => !storeIds.has(n.id))) {
      store.getState().setNodes(desired)
      return
    }

    // Same IDs → merge data changes while preserving position/selection
    const desiredMap = new Map(desired.map((n) => [n.id, n]))
    let dirty = false
    const merged = storeNodes.map((node) => {
      const next = desiredMap.get(node.id)
      if (!next || !hasFlowNodeChanged(node, next)) return node
      dirty = true
      // Preserve ReactFlow-managed state (position, selected, dragging, etc.)
      return { ...node, data: next.data, style: next.style, zIndex: next.zIndex } as CanvasFlowNode
    })
    if (dirty) {
      store.getState().setNodes(merged)
    }
  }, [dbNodes, dbGroups, store, hydratedRef, skipHydrationRef])

  // 3) Edge sync — ID 변경(추가/삭제) 또는 data 변경(label/선유형/화살표/색) 반영
  useEffect(() => {
    if (!hydratedRef.current || skipHydrationRef.current) return
    const storeEdges = store.getState().edges
    const storeIds = new Set(storeEdges.map((e) => e.id))
    const dbIds = new Set(dbEdges.map((e) => e.id))

    // ID set changed (structural add/remove) → full replacement
    if (storeIds.size !== dbIds.size || dbEdges.some((e) => !storeIds.has(e.id))) {
      store.getState().setEdges(dbEdges.map(toReactFlowEdge))
      return
    }

    // Same IDs → merge visual data changes while preserving selection state
    const desiredMap = new Map(dbEdges.map((e) => [e.id, toReactFlowEdge(e)]))
    let dirty = false
    const merged = storeEdges.map((edge) => {
      const next = desiredMap.get(edge.id)
      if (!next || edgeFingerprint(edge) === edgeFingerprint(next)) return edge
      dirty = true
      return { ...next, selected: edge.selected } as CanvasEdge
    })
    if (dirty) {
      store.getState().setEdges(merged)
    }
  }, [dbEdges, store, hydratedRef, skipHydrationRef])

  return { isLoading }
}
