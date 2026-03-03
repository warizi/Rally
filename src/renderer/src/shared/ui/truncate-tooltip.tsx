import { useRef, useState, useCallback } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip'

interface Props {
  children: React.ReactElement
  content: string
}

export function TruncateTooltip({ children, content }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const elRef = useRef<HTMLElement | null>(null)

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      const el = elRef.current
      if (!el || el.scrollWidth <= el.clientWidth) return
    }
    setOpen(next)
  }, [])

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger
        asChild
        ref={(node: HTMLElement | null) => {
          elRef.current = node
        }}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  )
}
