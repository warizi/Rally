import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { Folder, FolderOpen } from 'lucide-react'
import type { FolderNode } from '@entities/folder'

export function FolderNodeRenderer({
  node,
  style,
  dragHandle
}: NodeRendererProps<FolderNode>): JSX.Element {
  const Icon = node.isOpen ? FolderOpen : Folder

  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={() => node.toggle()}
    >
      <Icon className="ml-1 size-4 shrink-0" style={{ color: node.data.color ?? undefined }} />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
