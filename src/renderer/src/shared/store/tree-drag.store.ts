import { create } from 'zustand'

/**
 * 트리 노드 DnD의 활성 상태를 보관하는 store.
 *
 * 목적: 각 NodeRenderer가 `useDndContext()`를 직접 호출하면 dragover 마다 모든 row가 re-render된다.
 * 이 store에 dnd 상태를 한 번 집계하고 셀렉터(boolean)로 구독하면, 값이 실제로 바뀐 row만 리렌더링됨.
 *
 * 갱신 책임: `useTreeDragMonitor` (DndContext 내부에서 useDndMonitor로 dnd 이벤트 hook).
 */
interface TreeDragState {
  /** 트리 노드(`source: 'tree-node'`) 드래그가 진행 중인지 */
  isTreeDragActive: boolean
  /** 트리 드래그가 활성이고 source가 폴더 종류인지 */
  isFolderDrag: boolean
  /** 트리 드래그 source의 sourcePaneId (자기 패널 split-zone 비활성화 판정용) */
  sourcePaneId: string | null
  /** 폴더 드래그 시 cursor가 가리키는 타겟 폴더 id (없으면 null) */
  targetFolderId: string | null

  beginTreeDrag: (params: { isFolder: boolean; sourcePaneId: string }) => void
  setTargetFolderId: (id: string | null) => void
  endTreeDrag: () => void
}

export const useTreeDragStore = create<TreeDragState>((set) => ({
  isTreeDragActive: false,
  isFolderDrag: false,
  sourcePaneId: null,
  targetFolderId: null,
  beginTreeDrag: ({ isFolder, sourcePaneId }) =>
    set({
      isTreeDragActive: true,
      isFolderDrag: isFolder,
      sourcePaneId,
      targetFolderId: null
    }),
  setTargetFolderId: (targetFolderId) => set({ targetFolderId }),
  endTreeDrag: () =>
    set({
      isTreeDragActive: false,
      isFolderDrag: false,
      sourcePaneId: null,
      targetFolderId: null
    })
}))
