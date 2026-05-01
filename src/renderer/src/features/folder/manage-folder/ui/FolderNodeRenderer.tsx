import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ChevronRight } from 'lucide-react'
import { ENTITY_ICON, ENTITY_ICON_COLOR } from '@shared/constants/entity-icon'
import { TruncateTooltip } from '@shared/ui/truncate-tooltip'
import { REACT_ARBORIST_ROOT_ID } from '@shared/types/tree-drag'
import { cn } from '@/shared/lib/utils'
import type { FolderTreeNode } from '../model/types'
import { useTreeNodeDnd } from '../model/use-tree-node-dnd'
import { useAutoExpandOnHover } from '../model/use-auto-expand-on-hover'
import { useTreeDragStore } from '@shared/store/tree-drag.store'

interface FolderNodeRendererProps extends NodeRendererProps<FolderTreeNode> {
  workspaceId: string
  sourcePaneId: string
}

export function FolderNodeRenderer({
  node,
  style,
  workspaceId,
  sourcePaneId
}: FolderNodeRendererProps): JSX.Element {
  const parentRawId = node.parent?.id
  const parentId = !parentRawId || parentRawId === REACT_ARBORIST_ROOT_ID ? null : parentRawId
  const indent = node.level * node.tree.indent

  const dnd = useTreeNodeDnd({
    workspaceId,
    sourcePaneId,
    kind: 'folder',
    id: node.data.id,
    title: node.data.name,
    parentId,
    index: node.childIndex,
    isFolder: true
  })

  // 드래그 중 폴더 위에 머무르면 자동으로 펼침
  useAutoExpandOnHover(node, dnd.isIntoOver)

  // 폴더 source 드래그 시 자기가 타겟 폴더면 하이라이트.
  // 합성 boolean 셀렉터로 구독 — 자기 폴더 match 상태가 바뀔 때만 re-render.
  const isFolderDragTarget = useTreeDragStore(
    (s) => s.isFolderDrag && s.targetFolderId === node.data.id
  )
  // 형제 라인 가이드 표시 여부도 boolean으로 구독
  const isFolderDrag = useTreeDragStore((s) => s.isFolderDrag)

  const FolderIcon = ENTITY_ICON.folder

  return (
    <div style={style} className="relative h-full">
      <div
        ref={dnd.setDragRef}
        {...dnd.dragAttributes}
        {...dnd.dragListeners}
        className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer select-none h-full',
          dnd.isIntoOver || isFolderDragTarget ? 'bg-primary/15' : 'hover:bg-accent',
          dnd.isDragging && 'opacity-30'
        )}
        onClick={() => node.toggle()}
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            node.isOpen && 'rotate-90'
          )}
        />
        <FolderIcon
          className="size-4 shrink-0"
          style={{ color: node.data.color ?? ENTITY_ICON_COLOR.folder }}
        />
        <TruncateTooltip content={node.data.name}>
          <span className="text-sm truncate min-w-0">{node.data.name}</span>
        </TruncateTooltip>
      </div>

      {/* 드롭 슬롯: 폴더는 before/into/after 30:40:30 */}
      <div
        ref={dnd.setBeforeRef}
        className="absolute top-0 left-0 right-0 h-[30%] pointer-events-none"
      />
      <div
        ref={dnd.setIntoRef}
        className="absolute top-[30%] left-0 right-0 h-[40%] pointer-events-none"
      />
      <div
        ref={dnd.setAfterRef}
        className="absolute bottom-0 left-0 right-0 h-[30%] pointer-events-none"
      />

      {/* 폴더 source 드래그 시에는 형제 라인 가이드 안 표시 (폴더는 순서 없는 모델) */}
      {!isFolderDrag && dnd.isBeforeOver && (
        <div
          className="absolute top-0 right-2 h-0.5 bg-primary z-10 pointer-events-none"
          style={{ left: indent + 8 }}
        />
      )}
      {!isFolderDrag && dnd.isAfterOver && (
        <div
          className="absolute bottom-0 right-2 h-0.5 bg-primary z-10 pointer-events-none"
          style={{ left: indent + 8 }}
        />
      )}
    </div>
  )
}
