import { JSX } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { Sheet } from 'lucide-react'
import type { CsvTreeNode } from '../model/types'

interface CsvNodeRendererProps extends NodeRendererProps<CsvTreeNode> {
  onOpen: () => void
}

export function CsvNodeRenderer({
  node,
  style,
  dragHandle,
  onOpen
}: CsvNodeRendererProps): JSX.Element {
  return (
    <div
      ref={dragHandle}
      style={style}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-accent select-none"
      onClick={onOpen}
    >
      <Sheet className="ml-1 size-4 shrink-0 text-emerald-500" />
      <span className="text-sm truncate">{node.data.name}</span>
    </div>
  )
}
