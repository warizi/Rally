import { JSX, useEffect, useRef } from 'react'
import type { NodeRendererProps } from 'react-arborist'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import { TruncateTooltip } from '@shared/ui/truncate-tooltip'
import type { PdfTreeNode } from '../model/types'
import { useShowExtensionSetting } from '../model/use-show-extension-setting'

interface PdfNodeRendererProps extends NodeRendererProps<PdfTreeNode> {
  onOpen: () => void
  isActive?: boolean
}

export function PdfNodeRenderer({
  node,
  style,
  dragHandle,
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
      <PdfIcon className="ml-1 size-4 shrink-0 text-red-500" />
      <TruncateTooltip content={displayName}>
        <span className="text-sm truncate min-w-0">{displayName}</span>
      </TruncateTooltip>
    </div>
  )
}
