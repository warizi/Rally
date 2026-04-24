import { JSX, useEffect, useRef } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { Sheet } from 'lucide-react'
import type { CsvTreeNode } from '../model/types'
import { useShowExtensionSetting } from '../model/use-show-extension-setting'

interface CsvNodeRendererProps extends NodeRendererProps<CsvTreeNode> {
  onOpen: () => void
  isActive?: boolean
}

export function CsvNodeRenderer({
  node,
  style,
  dragHandle,
  onOpen,
  isActive
}: CsvNodeRendererProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const { enabled: showExtension } = useShowExtensionSetting()

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isActive])

  return (
    <div
      ref={(el) => {
        ref.current = el
        if (typeof dragHandle === 'function') dragHandle(el)
      }}
      style={style}
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer select-none ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
      onClick={onOpen}
    >
      <Sheet className="ml-1 size-4 shrink-0 text-emerald-500" />
      <span className="text-sm truncate">
        {node.data.name}
        {showExtension ? node.data.extension : ''}
      </span>
    </div>
  )
}
