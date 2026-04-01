import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

interface Props {
  title: string
  headerExtra?: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function CollapsibleSection({
  title,
  headerExtra,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
  className,
  contentClassName
}: Props): React.JSX.Element {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  function handleToggle(): void {
    const next = !open
    if (isControlled) {
      onOpenChange?.(next)
    } else {
      setInternalOpen(next)
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium hover:text-foreground transition-colors shrink-0"
        >
          <ChevronRight
            className={`h-3 w-3 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
          {title}
        </button>
        {headerExtra && <div onClick={(e) => e.stopPropagation()}>{headerExtra}</div>}
      </div>
      {open && (contentClassName ? <div className={contentClassName}>{children}</div> : children)}
    </div>
  )
}
