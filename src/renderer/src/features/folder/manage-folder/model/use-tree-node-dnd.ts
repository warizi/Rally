import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  TREE_AFTER_PREFIX,
  TREE_BEFORE_PREFIX,
  TREE_INTO_PREFIX,
  TREE_NODE_DRAG_PREFIX,
  type TreeDragData,
  type TreeDropData,
  type TreeNodeKind
} from '@shared/types/tree-drag'
import { useTreeDragStore } from '@shared/store/tree-drag.store'

interface UseTreeNodeDndArgs {
  workspaceId: string
  /** 이 트리가 속한 탐색기 탭의 paneId */
  sourcePaneId: string
  kind: TreeNodeKind
  id: string
  title: string
  parentId: string | null
  /** 부모의 children 배열에서 자기 인덱스 */
  index: number
  isFolder: boolean
}

interface UseTreeNodeDndReturn {
  // useDraggable
  setDragRef: (el: HTMLElement | null) => void
  dragAttributes: ReturnType<typeof useDraggable>['attributes']
  dragListeners: ReturnType<typeof useDraggable>['listeners']
  isDragging: boolean
  // 3 drop slots
  setBeforeRef: (el: HTMLElement | null) => void
  setAfterRef: (el: HTMLElement | null) => void
  setIntoRef: (el: HTMLElement | null) => void
  isBeforeOver: boolean
  isAfterOver: boolean
  isIntoOver: boolean
}

/**
 * 트리 노드 행에 @dnd-kit DnD를 부착한다.
 * - 자기 자신은 useDraggable로 드래그 소스 (id: `tree-node:{nodeId}`)
 * - 행 위/아래/(폴더면) 가운데에 useDroppable로 드롭 슬롯
 *   - before:    `tree-before:{nodeId}` → 부모에서 인덱스 `index` 위치에 삽입
 *   - after:     `tree-after:{nodeId}`  → 부모에서 인덱스 `index + 1` 위치에 삽입
 *   - into (폴더): `tree-into:{nodeId}` → 이 폴더의 마지막 자식으로 추가
 */
export function useTreeNodeDnd(args: UseTreeNodeDndArgs): UseTreeNodeDndReturn {
  const { workspaceId, sourcePaneId, kind, id, title, parentId, index, isFolder } = args

  const dragData: TreeDragData = {
    source: 'tree-node',
    workspaceId,
    sourcePaneId,
    kind,
    id,
    title,
    parentId
  }
  const draggable = useDraggable({
    id: `${TREE_NODE_DRAG_PREFIX}${id}`,
    data: dragData
  })

  // 트리 외부 source(예: 탭 드래그)일 때는 트리 drop slot 비활성. store 셀렉터로 boolean만 구독해
  // dragover 마다 모든 노드가 re-render되는 것을 막는다.
  const isTreeDragActive = useTreeDragStore((s) => s.isTreeDragActive)
  const dropDisabled = !isTreeDragActive

  const beforeData: TreeDropData = {
    target: 'tree-position',
    parentId,
    index,
    anchorNodeId: id
  }
  const afterData: TreeDropData = {
    target: 'tree-position',
    parentId,
    index: index + 1,
    anchorNodeId: id
  }
  const intoData: TreeDropData = {
    target: 'tree-into',
    folderId: id,
    anchorNodeId: id
  }

  const before = useDroppable({
    id: `${TREE_BEFORE_PREFIX}${id}`,
    data: beforeData,
    disabled: dropDisabled
  })
  const after = useDroppable({
    id: `${TREE_AFTER_PREFIX}${id}`,
    data: afterData,
    disabled: dropDisabled
  })
  const into = useDroppable({
    id: `${TREE_INTO_PREFIX}${id}`,
    data: intoData,
    disabled: dropDisabled || !isFolder
  })

  return {
    setDragRef: draggable.setNodeRef,
    dragAttributes: draggable.attributes,
    dragListeners: draggable.listeners,
    isDragging: draggable.isDragging,
    setBeforeRef: before.setNodeRef,
    setAfterRef: after.setNodeRef,
    setIntoRef: into.setNodeRef,
    isBeforeOver: before.isOver,
    isAfterOver: after.isOver,
    isIntoOver: into.isOver
  }
}
