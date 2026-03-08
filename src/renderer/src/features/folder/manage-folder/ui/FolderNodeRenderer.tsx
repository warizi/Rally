import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ChevronRight, Folder } from 'lucide-react'
import type { FolderTreeNode } from '../model/types'
import { cn } from '@/shared/lib/utils'

export function FolderNodeRenderer({
  node,
  style,
  dragHandle
}: NodeRendererProps<FolderTreeNode>): JSX.Element {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={() => node.toggle()}
    >
      <ChevronRight
        className={cn(
          'size-4 shrink-0 text-muted-foreground transition-transform',
          node.isOpen && 'rotate-90'
        )}
      />
      <Folder className="size-4 shrink-0" style={{ color: node.data.color ?? undefined }} />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
