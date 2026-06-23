import { useCallback } from 'react'
import type { OnNodesChange, NodeChange } from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'
import {
  useUpdateCanvasNode,
  useUpdateCanvasNodePositions,
  useRemoveCanvasNode,
  useUpdateCanvasGroup,
  useRemoveCanvasGroup
} from '@entities/canvas'
import type { CanvasFlowState } from './use-canvas-store'
import { findGroupForNode, getContainerId, collectDescendantIds } from './canvas-layout'

export function useCanvasNodeChanges(
  canvasId: string,
  store: StoreApi<CanvasFlowState>,
  pushHistory?: () => void
): { onNodesChange: OnNodesChange } {
  const { mutate: updateNode } = useUpdateCanvasNode()
  const { mutate: updatePositions } = useUpdateCanvasNodePositions()
  const { mutate: removeNode } = useRemoveCanvasNode()
  const { mutate: updateGroup } = useUpdateCanvasGroup()
  const { mutate: removeGroup } = useRemoveCanvasGroup()

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Push history before removals
      const hasRemove = changes.some((c) => c.type === 'remove')
      if (hasRemove) pushHistory?.()

      // 변경 적용 전 스냅샷으로 그룹 여부 판정
      const beforeNodes = store.getState().nodes
      const isGroup = (id: string): boolean =>
        beforeNodes.find((n) => n.id === id)?.type === 'groupNode'

      store.getState().applyNodeChanges(changes)

      // ── 위치 변경 (드래그 종료) ──
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

      // 일반 노드 위치 일괄 저장
      const nodePosUpdates = positionChanges
        .filter((c) => !isGroup(c.id))
        .map((c) => ({ id: c.id, x: c.position.x, y: c.position.y }))
      if (nodePosUpdates.length > 0) {
        updatePositions({ updates: nodePosUpdates, canvasId })
        pushHistory?.()
      }

      // 그룹 자체 위치 저장 (멤버 노드 동반 이동은 onNodeDragStart/Drag/Stop 에서 처리)
      for (const c of positionChanges.filter((c) => isGroup(c.id))) {
        updateGroup({ groupId: c.id, data: { x: c.position.x, y: c.position.y }, canvasId })
        pushHistory?.()
      }

      // ── 리사이즈 (dimensions 변경 종료) ──
      // 리사이즈된 그룹의 새 크기 (멤버십 재판정 시 최신 bounds 로 사용)
      const groupSizePatch = new Map<string, { width: number; height: number }>()
      for (const c of changes) {
        if (
          c.type === 'dimensions' &&
          'resizing' in c &&
          !c.resizing &&
          'dimensions' in c &&
          c.dimensions
        ) {
          if (isGroup(c.id)) {
            updateGroup({
              groupId: c.id,
              data: { width: c.dimensions.width, height: c.dimensions.height },
              canvasId
            })
            groupSizePatch.set(c.id, { width: c.dimensions.width, height: c.dimensions.height })
          } else {
            updateNode({
              nodeId: c.id,
              data: { width: c.dimensions.width, height: c.dimensions.height },
              canvasId
            })
          }
          pushHistory?.()
        }
      }

      // 그룹 리사이즈로 영역이 바뀌면 멤버십 재판정 (중심 기준 편입/이탈)
      if (groupSizePatch.size > 0) {
        // applyNodeChanges 는 data.width/height 를 갱신하지 않으므로 새 크기를 store data 에 먼저 반영
        store.getState().setNodes(
          store.getState().nodes.map((n) => {
            const patch = groupSizePatch.get(n.id)
            return patch
              ? ({
                  ...n,
                  data: { ...n.data, width: patch.width, height: patch.height }
                } as typeof n)
              : n
          })
        )
        const cur = store.getState().nodes
        const memberUpdates: { id: string; isGroup: boolean; containerId: string | null }[] = []
        for (const n of cur) {
          const center = {
            x: n.position.x + n.data.width / 2,
            y: n.position.y + n.data.height / 2
          }
          // 그룹 자신은 자기/자손 그룹에 편입되지 않도록 제외(사이클 방지)
          const exclude =
            n.type === 'groupNode'
              ? new Set<string>([n.id, ...collectDescendantIds(cur, n.id)])
              : undefined
          const target = findGroupForNode(cur, center, exclude)
          const currentG = getContainerId(n)
          if (target !== currentG) {
            memberUpdates.push({ id: n.id, isGroup: n.type === 'groupNode', containerId: target })
          }
        }
        if (memberUpdates.length > 0) {
          const map = new Map(memberUpdates.map((u) => [u.id, u.containerId]))
          // 낙관적 store 반영 (이후 그룹 드래그가 최신 소속을 읽도록). 노드/그룹 모두 data.groupId.
          store
            .getState()
            .setNodes(
              cur.map((n) =>
                map.has(n.id)
                  ? ({ ...n, data: { ...n.data, groupId: map.get(n.id)! } } as typeof n)
                  : n
              )
            )
          for (const u of memberUpdates) {
            if (u.isGroup) {
              updateGroup({ groupId: u.id, data: { parentId: u.containerId }, canvasId })
            } else {
              updateNode({ nodeId: u.id, data: { groupId: u.containerId }, canvasId })
            }
          }
          pushHistory?.()
        }
      }

      // ── 삭제 ──
      for (const c of changes.filter((c) => c.type === 'remove')) {
        if (isGroup(c.id)) {
          removeGroup({ groupId: c.id, canvasId })
        } else {
          removeNode({ nodeId: c.id, canvasId })
        }
      }
    },
    [
      canvasId,
      updatePositions,
      removeNode,
      updateNode,
      updateGroup,
      removeGroup,
      store,
      pushHistory
    ]
  )

  return { onNodesChange }
}
