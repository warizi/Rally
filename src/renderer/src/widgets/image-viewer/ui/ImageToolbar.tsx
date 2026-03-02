import { JSX } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@shared/ui/button'

interface ImageToolbarProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export function ImageToolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onReset
}: ImageToolbarProps): JSX.Element {
  return (
    <div className="flex items-center justify-center border-b px-3 py-1.5 bg-background gap-1">
      <Button variant="ghost" size="icon-sm" onClick={onZoomOut} disabled={scale <= 0.1}>
        <Minus className="size-4" />
      </Button>
      <span className="text-sm text-muted-foreground w-14 text-center">
        {Math.round(scale * 100)}%
      </span>
      <Button variant="ghost" size="icon-sm" onClick={onZoomIn} disabled={scale >= 10}>
        <Plus className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onReset}>
        <RotateCcw className="size-4" />
      </Button>
    </div>
  )
}
