import { useDndMonitor } from '@dnd-kit/core'
import { useTreeDragStore } from '@shared/store/tree-drag.store'
import type { TreeDragData, TreeDropData } from '@shared/types/tree-drag'

/**
 * @dnd-kit DnD 이벤트를 받아 useTreeDragStore에 집계.
 * 렌더러들이 useDndContext 대신 이 store에서 셀렉터로 boolean만 구독하도록 한다.
 *
 * - 목적: dragover 마다 useDndContext consumer가 전부 re-render되는 perf 핫스팟 제거.
 * - 호출 위치: MainLayout의 DndContext 안쪽 (always mounted).
 */
export function useTreeDragMonitor(): void {
  useDndMonitor({
    onDragStart: (event) => {
      const data = event.active.data.current as TreeDragData | undefined
      if (data?.source !== 'tree-node') return
      useTreeDragStore.getState().beginTreeDrag({
        isFolder: data.kind === 'folder',
        sourcePaneId: data.sourcePaneId
      })
    },
    onDragOver: (event) => {
      const sourceData = event.active.data.current as TreeDragData | undefined
      if (sourceData?.source !== 'tree-node') return
      const targetData = event.over?.data.current as TreeDropData | undefined
      let targetFolderId: string | null = null
      if (targetData?.target === 'tree-into') {
        targetFolderId = targetData.folderId
      } else if (targetData?.target === 'tree-position') {
        targetFolderId = targetData.parentId
      }
      // 같은 값이면 zustand가 알아서 subscriber notify 안 함 (Object.is 셀렉터 비교)
      const current = useTreeDragStore.getState().targetFolderId
      if (current !== targetFolderId) {
        useTreeDragStore.getState().setTargetFolderId(targetFolderId)
      }
    },
    onDragEnd: () => {
      useTreeDragStore.getState().endTreeDrag()
    },
    onDragCancel: () => {
      useTreeDragStore.getState().endTreeDrag()
    }
  })
}
