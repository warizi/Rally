/**
 * Tree DnD 이동 로직의 순수 헬퍼 함수들.
 *
 * `use-tree-move-listener` 에서 분리. dnd-kit / React 의존성이 없어
 * 단위 테스트로 S2 (노트 이동) / S3 (자손 드롭 차단) 시나리오를 cover 가능.
 */
import type { TreeNodeKind } from '@shared/types/tree-drag'
import type { WorkspaceTreeNode } from './types'

/**
 * tree 에서 parentId 의 children 을 찾아 반환.
 * parentId 가 null 이면 루트(워크스페이스 직속) 노드들. 못 찾으면 빈 배열.
 * 자식이 없는 폴더(빈 폴더)도 정확히 구분하기 위해 sentinel(null)을 사용한다.
 */
export function findChildrenByParentId(
  tree: WorkspaceTreeNode[],
  parentId: string | null
): WorkspaceTreeNode[] {
  if (parentId === null) return tree
  return findChildrenStrict(tree, parentId) ?? []
}

export function findChildrenStrict(
  tree: WorkspaceTreeNode[],
  parentId: string
): WorkspaceTreeNode[] | null {
  for (const node of tree) {
    if (node.kind !== 'folder') continue
    if (node.id === parentId) return node.children
    const found = findChildrenStrict(node.children, parentId)
    if (found !== null) return found
  }
  return null
}

/**
 * source 와 같은 종류만 카운트되는 sibling 판정.
 * - folder source: folder-only sibling 리스트
 * - leaf source(note/csv/pdf/image): leaf 전체 혼합 sibling 리스트
 *   (note + csv + pdf + image 는 단일 order space 를 공유)
 */
export function isRelevantSiblingKind(sourceKind: TreeNodeKind, candidate: TreeNodeKind): boolean {
  return sourceKind === 'folder' ? candidate === 'folder' : candidate !== 'folder'
}

/**
 * 백엔드 mutation 이 기대하는 index 로 변환.
 *
 * 백엔드 동작: 대상 부모의 sibling 리스트에서 source 를 먼저 제거한 뒤(`withoutSelf`)
 * `splice(index, 0, source)` 로 삽입하고 전체 reindex.
 *
 * 따라서 index = "source 자신을 제외한 관련 종류 sibling 중 combinedIndex 앞에 있는 개수".
 */
export function calculateMoveIndex(
  siblings: WorkspaceTreeNode[],
  combinedIndex: number,
  sourceId: string,
  sourceKind: TreeNodeKind
): number {
  return siblings
    .slice(0, combinedIndex)
    .filter((s) => s.id !== sourceId && isRelevantSiblingKind(sourceKind, s.kind)).length
}

/**
 * 폴더 안 끝에 추가될 때의 index 계산.
 * 관련 종류 자식 개수(자기 자신 제외) = 새 노드가 들어갈 위치.
 */
export function calculateAppendIndex(
  folderChildren: WorkspaceTreeNode[],
  sourceId: string,
  sourceKind: TreeNodeKind
): number {
  return folderChildren.filter(
    (c) => c.id !== sourceId && isRelevantSiblingKind(sourceKind, c.kind)
  ).length
}

/**
 * 자기 자신/자기 폴더로의 드롭 거부 검사.
 *
 * - tree-position: anchorNodeId === sourceId (자기 위/아래)
 * - tree-into: folderId === sourceId (자기 폴더 안)
 *
 * 자기 자손으로의 드롭 차단은 백엔드 mutation 검증에 위임 (트리 구조 순회 비용 회피).
 */
export function isSelfDrop(args: {
  target: 'tree-position' | 'tree-into'
  sourceId: string
  anchorNodeId?: string
  folderId?: string
}): boolean {
  if (args.target === 'tree-position') {
    return args.anchorNodeId === args.sourceId
  }
  return args.folderId === args.sourceId
}
