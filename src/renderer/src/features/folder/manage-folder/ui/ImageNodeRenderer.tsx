import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { ImageIcon } from 'lucide-react'
import type { ImageTreeNode } from '../model/types'

interface ImageNodeRendererProps extends NodeRendererProps<ImageTreeNode> {
  onOpen: () => void
}

export function ImageNodeRenderer({
  node,
  style,
  dragHandle,
  onOpen
}: ImageNodeRendererProps): JSX.Element {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={onOpen}
    >
      <ImageIcon className="ml-1 size-4 shrink-0 text-sky-500" />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
