import { useMemo } from 'react'
import { useCanvasNodes } from '@entities/canvas'
import type { NodeContentProps } from '../../model/node-content-registry'

export function CanvasNodeContent({ refId }: NodeContentProps): React.JSX.Element {
  const { data: nodes = [] } = useCanvasNodes(refId ?? undefined)

  const bounds = useMemo(() => {
    if (nodes.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      if (n.x < minX) minX = n.x
      if (n.y < minY) minY = n.y
      if (n.x + n.width > maxX) maxX = n.x + n.width
      if (n.y + n.height > maxY) maxY = n.y + n.height
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
  }, [nodes])

  if (!bounds || nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
        빈 캔버스
      </div>
    )
  }

  const padding = 8

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden p-3">
      <svg
        className="w-full h-full"
        viewBox={`${bounds.minX - padding} ${bounds.minY - padding} ${bounds.w + padding * 2} ${bounds.h + padding * 2}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {nodes.map((n) => (
          <rect
            key={n.id}
            x={n.x}
            y={n.y}
            width={n.width}
            height={n.height}
            rx={4}
            fill="var(--muted)"
            stroke="var(--border)"
            strokeWidth={2}
          />
        ))}
      </svg>
    </div>
  )
}
