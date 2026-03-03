import { useMemo, useCallback } from 'react'
import {
  useCanvasById,
  useCreateCanvasNode,
  useUpdateCanvasNode,
  useUpdateCanvasEdge,
  useUpdateCanvasViewport,
  type CanvasNodeItem
} from '@entities/canvas'
import { NODE_TYPE_REGISTRY } from './node-type-registry'
import { useCanvasStore } from './use-canvas-store'
import { useCanvasHydration } from './use-canvas-hydration'
import { useCanvasNodeChanges } from './use-canvas-node-changes'
import { useCanvasEdgeChanges } from './use-canvas-edge-changes'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useCanvasData(canvasId: string) {
  // Sub-hooks (호출 순서 고정 — effect 실행 순서 보장)
  const { store, nodes, edges, hydrated, hydratedRef } = useCanvasStore(canvasId)
  const { isLoading } = useCanvasHydration(canvasId, store, hydratedRef)
  const { onNodesChange } = useCanvasNodeChanges(canvasId, store)
  const { onEdgesChange, onConnect } = useCanvasEdgeChanges(canvasId, store)

  // Viewport (DB 기반 — ReactFlow 불필요)
  const { data: canvas } = useCanvasById(canvasId)
  const defaultViewport = useMemo(
    () => ({
      x: canvas?.viewportX ?? 0,
      y: canvas?.viewportY ?? 0,
      zoom: canvas?.viewportZoom ?? 1
    }),
    [canvas?.viewportX, canvas?.viewportY, canvas?.viewportZoom]
  )

  // Mutations (좌표를 매개변수로 받아 ReactFlow 불필요)
  const { mutate: updateViewport } = useUpdateCanvasViewport()
  const { mutate: createNode } = useCreateCanvasNode()
  const { mutate: updateNode } = useUpdateCanvasNode()
  const { mutate: updateEdge } = useUpdateCanvasEdge()

  const saveViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      updateViewport({ canvasId, viewport })
    },
    [canvasId, updateViewport]
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

  return {
    nodes,
    edges,
    isLoading,
    hydrated,
    defaultViewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    saveViewport,
    addTextNode,
    addRefNode,
    createNode,
    updateNode,
    updateEdge,
    store
  }
}
