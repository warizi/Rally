import { useCallback } from 'react'
import type { OnEdgesChange, OnConnect } from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'
import { useCreateCanvasEdge, useRemoveCanvasEdge, toCreateCanvasEdgeData } from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'

export function useCanvasEdgeChanges(canvasId: string, store: StoreApi<CanvasFlowState>) {
  const { mutate: createEdge } = useCreateCanvasEdge()
  const { mutate: removeEdge } = useRemoveCanvasEdge()

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      store.getState().applyEdgeChanges(changes)

      const removeChanges = changes.filter((c) => c.type === 'remove')
      for (const c of removeChanges) {
        removeEdge({ edgeId: c.id, canvasId })
      }
    },
    [canvasId, removeEdge, store]
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return
      createEdge({
        canvasId,
        data: toCreateCanvasEdgeData(connection)
      })
    },
    [canvasId, createEdge]
  )

  return { onEdgesChange, onConnect }
}
