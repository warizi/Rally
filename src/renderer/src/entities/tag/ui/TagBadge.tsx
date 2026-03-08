import { X } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/ui/tooltip'
import type { TagItem } from '../model/types'

interface TagBadgeProps {
  tag: TagItem
  onRemove?: () => void
  className?: string
}

export function TagBadge({ tag, onRemove, className }: TagBadgeProps): React.JSX.Element {
  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
    >
      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )

  if (!tag.description) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>{tag.description}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
