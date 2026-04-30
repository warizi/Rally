import { JSX, useEffect, useRef } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { TruncateTooltip } from '@shared/ui/truncate-tooltip'
import { REACT_ARBORIST_ROOT_ID } from '@shared/types/tree-drag'
import { cn } from '@shared/lib/utils'
import type { PdfTreeNode } from '../model/types'
import { useShowExtensionSetting } from '../model/use-show-extension-setting'
import { useTreeNodeDnd } from '../model/use-tree-node-dnd'
import { useTreeDragStore } from '@shared/store/tree-drag.store'

interface PdfNodeRendererProps extends NodeRendererProps<PdfTreeNode> {
  workspaceId: string
  sourcePaneId: string
  onOpen: () => void
  isActive?: boolean
}

export function PdfNodeRenderer({
  node,
  style,
  workspaceId,
  sourcePaneId,
  onOpen,
  isActive
}: PdfNodeRendererProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const { enabled: showExtension } = useShowExtensionSetting()

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isActive])

  const displayName = `${node.data.name}${showExtension ? node.data.extension : ''}`
  const parentRawId = node.parent?.id
  const parentId = !parentRawId || parentRawId === REACT_ARBORIST_ROOT_ID ? null : parentRawId
  const indent = node.level * node.tree.indent

  const dnd = useTreeNodeDnd({
    workspaceId,
    sourcePaneId,
    kind: 'pdf',
    id: node.data.id,
    title: displayName,
    parentId,
    index: node.childIndex,
    isFolder: false
  })

  const isFolderDrag = useTreeDragStore((s) => s.isFolderDrag)

  return (
    <div ref={ref} style={style} className="relative h-full">
      <div
        ref={dnd.setDragRef}
        {...dnd.dragAttributes}
        {...dnd.dragListeners}
        className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer select-none h-full',
          isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent',
          dnd.isDragging && 'opacity-30'
        )}
        onClick={onOpen}
      >
        <PdfIcon className="ml-1 size-4 shrink-0 text-red-500" />
        <TruncateTooltip content={displayName}>
          <span className="text-sm truncate min-w-0">{displayName}</span>
        </TruncateTooltip>
      </div>

      <div
        ref={dnd.setBeforeRef}
        className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none"
      />
      <div
        ref={dnd.setAfterRef}
        className="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-none"
      />

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
