import { useCallback } from 'react'
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { useMoveFolder } from '@entities/folder'
import { useMoveNote } from '@entities/note'
import { useMoveCsvFile } from '@entities/csv-file'
import { useMovePdfFile } from '@entities/pdf-file'
import { useMoveImageFile } from '@entities/image-file'
import type {
  TreeDragData,
  TreeDropData,
  TreeNodeKind
} from '@shared/types/tree-drag'
import { useWorkspaceTree } from './use-workspace-tree'
import type { WorkspaceTreeNode } from './types'

interface MoveParams {
  parentId: string | null
  index: number
}

/**
 * tree에서 parentId의 children을 찾아 반환한다.
 * parentId가 null이면 루트(워크스페이스 직속) 노드들. 못 찾으면 빈 배열.
 * 자식이 없는 폴더(빈 폴더)도 정확히 구분하기 위해 sentinel(null)을 사용한다.
 */
function findChildrenByParentId(
  tree: WorkspaceTreeNode[],
  parentId: string | null
): WorkspaceTreeNode[] {
  if (parentId === null) return tree
  return findChildrenStrict(tree, parentId) ?? []
}

function findChildrenStrict(
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
 * react-arborist의 combinedIndex(children 통합 배열에서의 위치)를
 * 백엔드 mutation이 기대하는 sourceKind별 index로 변환한다.
 *
 * 같은 부모에 폴더 N개 + 노트 M개가 섞여 있을 때, 노트를 N+M번째 자리에 떨어뜨려도
 * moveNote는 "노트들 중 N+M번째"로 해석되어 잘못된 위치로 가는 버그를 방지한다.
 */
function toKindSpecificIndex(
  children: WorkspaceTreeNode[],
  combinedIndex: number,
  sourceKind: TreeNodeKind
): number {
  return children
    .slice(0, combinedIndex)
    .filter((c) => c.kind === sourceKind).length
}

/**
 * @dnd-kit DragEnd 이벤트를 구독해 트리 내 노드 이동(폴더 간 이동, 형제 사이 정확한 위치)을 처리한다.
 * - source: TreeDragData (워크스페이스 일치 검사)
 * - target: TreeDropData ('tree-position' | 'tree-into')
 *
 * 자기 자신 또는 자기 자식으로의 드롭은 거부한다(자기 자신은 anchorNodeId로 검사,
 * 자기 자식은 mutation의 백엔드 검증에 위임).
 */
export function useTreeMoveListener(workspaceId: string): void {
  const { mutate: moveFolder } = useMoveFolder()
  const { mutate: moveNote } = useMoveNote()
  const { mutate: moveCsv } = useMoveCsvFile()
  const { mutate: movePdf } = useMovePdfFile()
  const { mutate: moveImage } = useMoveImageFile()
  const { tree } = useWorkspaceTree(workspaceId)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const sourceData = event.active.data.current as TreeDragData | undefined
      const targetData = event.over?.data.current as TreeDropData | undefined
      if (!sourceData || !targetData) return
      if (sourceData.source !== 'tree-node') return
      // 다른 워크스페이스로의 드롭은 무시 (각 FolderTree가 자기 워크스페이스만 처리)
      if (sourceData.workspaceId !== workspaceId) return

      // tree-position / tree-into 만 처리. 그 외 (tab-list, split-zone 등)는 다른 listener가 처리
      let move: MoveParams | null = null
      if (targetData.target === 'tree-position') {
        // 자기 자신 위/아래로 드롭은 의미 없음
        if (targetData.anchorNodeId === sourceData.id) return
        // react-arborist의 combinedIndex를 source kind별 index로 변환.
        // (같은 부모의 children에 폴더와 파일이 섞여 있어도 백엔드는 kind별 분리된 order를 가짐)
        const siblings = findChildrenByParentId(tree, targetData.parentId)
        const kindIndex = toKindSpecificIndex(siblings, targetData.index, sourceData.kind)
        move = { parentId: targetData.parentId, index: kindIndex }
      } else if (targetData.target === 'tree-into') {
        // 자기 자신 안으로 드롭 차단
        if (targetData.folderId === sourceData.id) return
        // 폴더 안 마지막 자식으로 추가 = 같은 kind 자식의 개수
        const folderChildren = findChildrenByParentId(tree, targetData.folderId)
        const kindIndex = folderChildren.filter((c) => c.kind === sourceData.kind).length
        move = { parentId: targetData.folderId, index: kindIndex }
      } else {
        return
      }

      switch (sourceData.kind) {
        case 'folder':
          moveFolder({
            workspaceId,
            folderId: sourceData.id,
            parentFolderId: move.parentId,
            index: move.index
          })
          break
        case 'note':
          moveNote({
            workspaceId,
            noteId: sourceData.id,
            folderId: move.parentId,
            index: move.index
          })
          break
        case 'csv':
          moveCsv({
            workspaceId,
            csvId: sourceData.id,
            folderId: move.parentId,
            index: move.index
          })
          break
        case 'pdf':
          movePdf({
            workspaceId,
            pdfId: sourceData.id,
            folderId: move.parentId,
            index: move.index
          })
          break
        case 'image':
          moveImage({
            workspaceId,
            imageId: sourceData.id,
            folderId: move.parentId,
            index: move.index
          })
          break
      }
    },
    [workspaceId, tree, moveFolder, moveNote, moveCsv, movePdf, moveImage]
  )

  useDndMonitor({ onDragEnd: handleDragEnd })
}
