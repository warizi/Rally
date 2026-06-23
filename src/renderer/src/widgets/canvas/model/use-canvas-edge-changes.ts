import { useCallback } from 'react'
import type { OnEdgesChange, OnConnect } from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'
import {
  useCreateCanvasEdge,
  useRemoveCanvasEdge,
  toCreateCanvasEdgeData,
  toReactFlowEdge
} from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'

export function useCanvasEdgeChanges(
  canvasId: string,
  store: StoreApi<CanvasFlowState>,
  pushHistory?: () => void
): { onEdgesChange: OnEdgesChange; onConnect: OnConnect } {
  const { mutate: createEdge } = useCreateCanvasEdge()
  const { mutate: removeEdge } = useRemoveCanvasEdge()

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const hasRemove = changes.some((c) => c.type === 'remove')
      if (hasRemove) pushHistory?.()

      store.getState().applyEdgeChanges(changes)

      const removeChanges = changes.filter((c) => c.type === 'remove')
      for (const c of removeChanges) {
        removeEdge({ edgeId: c.id, canvasId })
      }
    },
    [canvasId, removeEdge, store, pushHistory]
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return
      // createEdge 는 비동기라 즉시 store 에 반영되지 않는다. 생성 성공 후 실제 id 를 가진
      // edge 를 store 에 반영한 뒤 history 를 캡처해야 한다. (이전엔 생성 직후 pushHistory 가
      // edge 없는 상태를 스냅샷 → undo/redo 가 edge 를 누락/삭제하던 불안정의 원인)
      createEdge(
        { canvasId, data: toCreateCanvasEdgeData(connection) },
        {
          onSuccess: (created) => {
            const edges = store.getState().edges
            if (!edges.some((e) => e.id === created.id)) {
              store.getState().setEdges([...edges, toReactFlowEdge(created)])
            }
            pushHistory?.()
          }
        }
      )
    },
    [canvasId, createEdge, pushHistory, store]
  )

  return { onEdgesChange, onConnect }
}
