import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ChevronRight, Folder } from 'lucide-react'
import { TruncateTooltip } from '@shared/ui/truncate-tooltip'
import { REACT_ARBORIST_ROOT_ID } from '@shared/types/tree-drag'
import { cn } from '@/shared/lib/utils'
import type { FolderTreeNode } from '../model/types'
import { useTreeNodeDnd } from '../model/use-tree-node-dnd'
import { useAutoExpandOnHover } from '../model/use-auto-expand-on-hover'

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

  return (
    <div style={style} className="relative h-full">
      <div
        ref={dnd.setDragRef}
        {...dnd.dragAttributes}
        {...dnd.dragListeners}
        className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer select-none h-full',
          dnd.isIntoOver ? 'bg-primary/15' : 'hover:bg-accent',
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
        <Folder className="size-4 shrink-0" style={{ color: node.data.color ?? undefined }} />
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

      {dnd.isBeforeOver && (
        <div
          className="absolute top-0 right-2 h-0.5 bg-primary z-10 pointer-events-none"
          style={{ left: indent + 8 }}
        />
      )}
      {dnd.isAfterOver && (
        <div
          className="absolute bottom-0 right-2 h-0.5 bg-primary z-10 pointer-events-none"
          style={{ left: indent + 8 }}
        />
      )}
    </div>
  )
}
