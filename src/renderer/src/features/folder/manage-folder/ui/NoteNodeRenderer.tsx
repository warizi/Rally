import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { FileText } from 'lucide-react'
import type { NoteTreeNode } from '../model/types'

interface NoteNodeRendererProps extends NodeRendererProps<NoteTreeNode> {
  onOpen: () => void
}

export function NoteNodeRenderer({
  node,
  style,
  dragHandle,
  onOpen
}: NoteNodeRendererProps): JSX.Element {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={onOpen}
    >
      <FileText className="ml-1 size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
