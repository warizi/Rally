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
 * 백엔드 mutation이 기대하는 index로 변환한다.
 *
 * 백엔드 동작: 대상 부모의 sibling 리스트에서 source를 먼저 제거한 뒤(`withoutSelf`)
 * `splice(index, 0, source)`로 삽입하고 전체 reindex.
 * - folder source: folder-only sibling 리스트
 * - leaf source(note/csv/pdf/image): leaf 전체 혼합 sibling 리스트
 *   (note + csv + pdf + image는 단일 order space를 공유)
 *
 * 따라서 index = "source 자신을 제외한 관련 종류 sibling 중 combinedIndex 앞에 있는 개수".
 */
function calculateMoveIndex(
  siblings: WorkspaceTreeNode[],
  combinedIndex: number,
  sourceId: string,
  sourceKind: TreeNodeKind
): number {
  const isFolderSource = sourceKind === 'folder'
  const isRelevantKind = (kind: TreeNodeKind): boolean =>
    isFolderSource ? kind === 'folder' : kind !== 'folder'

  return siblings
    .slice(0, combinedIndex)
    .filter((s) => s.id !== sourceId && isRelevantKind(s.kind)).length
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
      const isFolderSource = sourceData.kind === 'folder'
      const isRelevantKind = (kind: TreeNodeKind): boolean =>
        isFolderSource ? kind === 'folder' : kind !== 'folder'

      if (targetData.target === 'tree-position') {
        // 자기 자신 위/아래로 드롭은 의미 없음
        if (targetData.anchorNodeId === sourceData.id) return
        const siblings = findChildrenByParentId(tree, targetData.parentId)
        const index = calculateMoveIndex(
          siblings,
          targetData.index,
          sourceData.id,
          sourceData.kind
        )
        move = { parentId: targetData.parentId, index }
      } else if (targetData.target === 'tree-into') {
        // 자기 자신 안으로 드롭 차단
        if (targetData.folderId === sourceData.id) return
        // 폴더 안 끝에 추가 = 관련 종류 자식 개수(자기 자신 제외)
        const folderChildren = findChildrenByParentId(tree, targetData.folderId)
        const index = folderChildren.filter(
          (c) => c.id !== sourceData.id && isRelevantKind(c.kind)
        ).length
        move = { parentId: targetData.folderId, index }
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
