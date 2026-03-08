import { useMemo, useCallback, useRef } from 'react'
import {
  useCanvasById,
  useCreateCanvasNode,
  useCreateCanvasEdge,
  useUpdateCanvasNode,
  useUpdateCanvasEdge,
  useUpdateCanvasViewport,
  useSyncCanvasState,
  type CanvasNodeItem
} from '@entities/canvas'
import { useTabStore } from '@features/tap-system/manage-tab-system'
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
    createNode,
    createNodeAsync,
    createEdgeAsync,
    updateNode,
    updateEdge,
    store,
    undo,
    redo,
    canUndo,
    canRedo
  }
}
