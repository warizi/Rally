import { useMemo, useCallback, useRef } from 'react'
import {
  useCanvasById,
  useCreateCanvasNode,
  useCreateCanvasEdge,
  useUpdateCanvasNode,
  useUpdateCanvasEdge,
  useUpdateCanvasViewport,
  useSyncCanvasState,
  useCreateCanvasGroup,
  useUpdateCanvasGroup,
  useUpdateCanvasNodePositions,
  type CanvasNodeItem
} from '@entities/canvas'
import { useTabStore } from '@/entities/tab-system'
import { NODE_TYPE_REGISTRY } from './node-type-registry'
import { useCanvasStore } from './use-canvas-store'
import { useCanvasHydration } from './use-canvas-hydration'
import { useCanvasNodeChanges } from './use-canvas-node-changes'
import { useCanvasEdgeChanges } from './use-canvas-edge-changes'
import { useCanvasHistory } from './use-canvas-history'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useCanvasData(canvasId: string, tabId?: string) {
  // Sub-hooks (호출 순서 고정 — effect 실행 순서 보장)
  const { store, nodes, edges, hydrated, hydratedRef } = useCanvasStore(canvasId)
  const skipHydrationRef = useRef(false)
  const syncStateMutation = useSyncCanvasState()

  const { pushHistory, undo, redo, canUndo, canRedo, initHistory } = useCanvasHistory(
    canvasId,
    store,
    syncStateMutation,
    skipHydrationRef
  )

  const { isLoading } = useCanvasHydration(
    canvasId,
    store,
    hydratedRef,
    skipHydrationRef,
    initHistory
  )
  const { onNodesChange } = useCanvasNodeChanges(canvasId, store, pushHistory)
  const { onEdgesChange, onConnect } = useCanvasEdgeChanges(canvasId, store, pushHistory)

  // Viewport (searchParams 우선, DB 폴백)
  const { data: canvas } = useCanvasById(canvasId)
  const tabSearchParams = useTabStore((s) => (tabId ? s.tabs[tabId]?.searchParams : undefined))
  const navigateTab = useTabStore((s) => s.navigateTab)

  const defaultViewport = useMemo(() => {
    if (tabSearchParams?.vx) {
      return {
        x: parseFloat(tabSearchParams.vx),
        y: parseFloat(tabSearchParams.vy ?? '0'),
        zoom: parseFloat(tabSearchParams.vz ?? '1')
      }
    }
    return {
      x: canvas?.viewportX ?? 0,
      y: canvas?.viewportY ?? 0,
      zoom: canvas?.viewportZoom ?? 1
    }
  }, [
    tabSearchParams?.vx,
    tabSearchParams?.vy,
    tabSearchParams?.vz,
    canvas?.viewportX,
    canvas?.viewportY,
    canvas?.viewportZoom
  ])

  // Mutations (좌표를 매개변수로 받아 ReactFlow 불필요)
  const { mutate: updateViewport } = useUpdateCanvasViewport()
  const { mutate: createNode, mutateAsync: createNodeAsync } = useCreateCanvasNode()
  const { mutateAsync: createEdgeAsync } = useCreateCanvasEdge()
  const { mutate: updateNode } = useUpdateCanvasNode()
  const { mutate: updateEdge } = useUpdateCanvasEdge()
  const { mutate: createGroup, mutateAsync: createGroupAsync } = useCreateCanvasGroup()
  const { mutate: updateGroup } = useUpdateCanvasGroup()
  const { mutate: updateNodePositions } = useUpdateCanvasNodePositions()

  const saveViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      updateViewport({ canvasId, viewport })
      if (tabId) {
        const current = useTabStore.getState().tabs[tabId]?.searchParams
        navigateTab(tabId, {
          searchParams: {
            ...current,
            vx: String(viewport.x),
            vy: String(viewport.y),
            vz: String(viewport.zoom)
          }
        })
      }
    },
    [canvasId, updateViewport, tabId, navigateTab]
  )

  const addTextNode = useCallback(
    (x: number, y: number) => {
      createNode({
        canvasId,
        data: { type: 'text', x, y, width: 260, height: 160 }
      })
    },
    [canvasId, createNode]
  )

  const addRefNode = useCallback(
    (type: CanvasNodeItem['type'], refId: string, x: number, y: number) => {
      const config = NODE_TYPE_REGISTRY[type]
      createNode({
        canvasId,
        data: {
          type,
          refId,
          x,
          y,
          width: config?.defaultWidth ?? 260,
          height: config?.defaultHeight ?? 160
        }
      })
    },
    [canvasId, createNode]
  )

  // ── 그룹 ──
  const addGroup = useCallback(
    (x: number, y: number, width = 320, height = 240) => {
      createGroup({ canvasId, data: { x, y, width, height } })
    },
    [canvasId, createGroup]
  )

  /** 선택된 노드/그룹들을 감싸는 새 그룹 생성 + 멤버 소속 설정(그룹도 중첩 가능) */
  const groupSelectedNodes = useCallback(async () => {
    const selected = store.getState().nodes.filter((n) => n.selected)
    if (selected.length === 0) return
    const PAD = 30
    const minX = Math.min(...selected.map((n) => n.position.x)) - PAD
    const minY = Math.min(...selected.map((n) => n.position.y)) - PAD - 24 // 라벨 공간
    const maxX = Math.max(...selected.map((n) => n.position.x + n.data.width)) + PAD
    const maxY = Math.max(...selected.map((n) => n.position.y + n.data.height)) + PAD
    const group = await createGroupAsync({
      canvasId,
      data: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    })
    for (const n of selected) {
      if (n.type === 'groupNode') {
        updateGroup({ groupId: n.id, data: { parentId: group.id }, canvasId })
      } else {
        updateNode({ nodeId: n.id, data: { groupId: group.id }, canvasId })
      }
    }
  }, [store, canvasId, createGroupAsync, updateNode, updateGroup])

  /** 노드의 그룹 소속 변경(드래그 편입/이탈) */
  const setNodeGroup = useCallback(
    (nodeId: string, groupId: string | null) => {
      updateNode({ nodeId, data: { groupId }, canvasId })
    },
    [canvasId, updateNode]
  )

  /** 그룹의 부모 그룹 소속 변경(중첩 편입/이탈) */
  const setGroupParent = useCallback(
    (groupId: string, parentId: string | null) => {
      updateGroup({ groupId, data: { parentId }, canvasId })
    },
    [canvasId, updateGroup]
  )

  /** 멤버 노드 위치 일괄 영속화 (그룹 드래그 종료 시) */
  const persistNodePositions = useCallback(
    (updates: { id: string; x: number; y: number }[]) => {
      if (updates.length === 0) return
      updateNodePositions({ updates, canvasId })
    },
    [canvasId, updateNodePositions]
  )

  /** 자식 그룹 위치 영속화 (그룹 드래그 종료 시 — 그룹엔 batch 가 없어 개별 update) */
  const persistGroupPositions = useCallback(
    (updates: { id: string; x: number; y: number }[]) => {
      for (const u of updates) {
        updateGroup({ groupId: u.id, data: { x: u.x, y: u.y }, canvasId })
      }
    },
    [canvasId, updateGroup]
  )

  const hasSavedViewport = !!tabSearchParams?.vx

  return {
    nodes,
    edges,
    isLoading,
    hydrated,
    defaultViewport,
    hasSavedViewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    saveViewport,
    addTextNode,
    addRefNode,
    addGroup,
    groupSelectedNodes,
    setNodeGroup,
    setGroupParent,
    persistNodePositions,
    persistGroupPositions,
    createNode,
    createNodeAsync,
    createEdgeAsync,
    updateNode,
    updateEdge,
    store,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo
  }
}
