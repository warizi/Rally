import type { Node } from '@xyflow/react'

const OVERLAP_OFFSET = 30
const MAX_ATTEMPTS = 20

export function findNonOverlappingPosition(
  nodes: Node[],
  baseX: number,
  baseY: number,
  width = 260,
  height = 160
): { x: number; y: number } {
  let x = baseX
  let y = baseY

  const isOverlapping = (cx: number, cy: number): boolean =>
    nodes.some(
      (n) => Math.abs(n.position.x - cx) < width * 0.5 && Math.abs(n.position.y - cy) < height * 0.5
    )

  let attempts = 0
  while (isOverlapping(x, y) && attempts < MAX_ATTEMPTS) {
    x += OVERLAP_OFFSET
    y += OVERLAP_OFFSET
    attempts++
  }

  return { x, y }
}
