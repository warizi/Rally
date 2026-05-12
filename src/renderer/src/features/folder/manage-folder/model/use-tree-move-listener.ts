import { useCallback } from 'react'
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { useMoveFolder } from '@entities/folder'
import { useMoveNote } from '@entities/note'
import { useMoveCsvFile } from '@entities/csv-file'
import { useMovePdfFile } from '@entities/pdf-file'
import { useMoveImageFile } from '@entities/image-file'
import type { TreeDragData, TreeDropData } from '@shared/types/tree-drag'
import { useWorkspaceTree } from './use-workspace-tree'
import {
  findChildrenByParentId,
  calculateMoveIndex,
  calculateAppendIndex,
  isSelfDrop
} from './tree-move-helpers'

interface MoveParams {
  parentId: string | null
  index: number
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
        if (
          isSelfDrop({
            target: 'tree-position',
            sourceId: sourceData.id,
            anchorNodeId: targetData.anchorNodeId
          })
        ) {
          return
        }
        const siblings = findChildrenByParentId(tree, targetData.parentId)
        const index = calculateMoveIndex(siblings, targetData.index, sourceData.id, sourceData.kind)
        move = { parentId: targetData.parentId, index }
      } else if (targetData.target === 'tree-into') {
        if (
          isSelfDrop({
            target: 'tree-into',
            sourceId: sourceData.id,
            folderId: targetData.folderId
          })
        ) {
          return
        }
        const folderChildren = findChildrenByParentId(tree, targetData.folderId)
        const index = calculateAppendIndex(folderChildren, sourceData.id, sourceData.kind)
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
