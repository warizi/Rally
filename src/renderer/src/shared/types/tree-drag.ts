// @dnd-kit으로 통일한 트리 DnD에서 사용하는 공용 타입과 ID prefix.
// useDraggable의 data와 useDroppable의 data를 강타입으로 다루기 위해 정의한다.

// react-arborist 내부의 가상 root 노드 ID. node.parent?.id가 이 값이면 워크스페이스 루트 의미.
export const REACT_ARBORIST_ROOT_ID = '__REACT_ARBORIST_INTERNAL_ROOT__'

export type TreeNodeKind = 'folder' | 'note' | 'csv' | 'pdf' | 'image'

// useDraggable id prefix
export const TREE_NODE_DRAG_PREFIX = 'tree-node:' as const

// useDroppable id prefixes
export const TREE_BEFORE_PREFIX = 'tree-before:' as const
export const TREE_AFTER_PREFIX = 'tree-after:' as const
export const TREE_INTO_PREFIX = 'tree-into:' as const

// 드래그 페이로드 (active.data.current)
export interface TreeDragData {
  source: 'tree-node'
  workspaceId: string
  /**
   * 이 트리 노드가 속한 탐색기 탭이 표시되는 paneId.
   * 자기 패널의 split-zone을 비활성화하기 위해 사용 (자기 패널을 분할해 자기 자신을 띄울 수 없음).
   * tabId가 없거나 패널을 못 찾으면 빈 문자열.
   */
  sourcePaneId: string
  kind: TreeNodeKind
  id: string
  title: string
  parentId: string | null
}

// 드롭 타깃 페이로드 (over.data.current)
export type TreeDropData =
  | {
      target: 'tree-position'
      parentId: string | null // null = 워크스페이스 루트
      index: number
      // 자기 자신 또는 자기 자식으로의 드롭 차단용 식별자
      anchorNodeId: string
    }
  | {
      target: 'tree-into'
      folderId: string
      // 자기 자신 또는 자기 자식으로의 드롭 차단용
      anchorNodeId: string
    }

export function isTreeNodeDragId(id: string): boolean {
  return id.startsWith(TREE_NODE_DRAG_PREFIX)
}
