import { useCallback } from 'react'
import type { OnNodesChange, NodeChange } from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'
import {
  useUpdateCanvasNode,
  useUpdateCanvasNodePositions,
  useRemoveCanvasNode
} from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'

export function useCanvasNodeChanges(
  canvasId: string,
  store: StoreApi<CanvasFlowState>,
  pushHistory?: () => void
): { onNodesChange: OnNodesChange } {
  const { mutate: updateNode } = useUpdateCanvasNode()
  const { mutate: updatePositions } = useUpdateCanvasNodePositions()
  const { mutate: removeNode } = useRemoveCanvasNode()

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Push history before removals
      const hasRemove = changes.some((c) => c.type === 'remove')
      if (hasRemove) pushHistory?.()

      store.getState().applyNodeChanges(changes)

      // Persist position changes on drag end
      const positionChanges = changes.filter(
        (
          c
        ): c is NodeChange & {
          type: 'position'
          dragging: false
          position: { x: number; y: number }
        } =>
          c.type === 'position' && 'dragging' in c && !c.dragging && 'position' in c && !!c.position
      )
      if (positionChanges.length > 0) {
        updatePositions({
          updates: positionChanges.map((c) => ({
            id: c.id,
            x: c.position.x,
            y: c.position.y
          })),
          canvasId
        })
        pushHistory?.()
      }

      // Handle resize (dimensions change)
      for (const c of changes) {
        if (
          c.type === 'dimensions' &&
          'resizing' in c &&
          !c.resizing &&
          'dimensions' in c &&
          c.dimensions
        ) {
          updateNode({
            nodeId: c.id,
            data: { width: c.dimensions.width, height: c.dimensions.height },
            canvasId
          })
          pushHistory?.()
        }
      }

      // Handle removals
      const removeChanges = changes.filter((c) => c.type === 'remove')
      for (const c of removeChanges) {
        removeNode({ nodeId: c.id, canvasId })
      }
    },
    [canvasId, updatePositions, removeNode, updateNode, store, pushHistory]
  )

  return { onNodesChange }
}
