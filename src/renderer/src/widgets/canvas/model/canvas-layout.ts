import type { Node } from '@xyflow/react'
import type { CanvasFlowNode } from '@entities/canvas'

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

/**
 * 주어진 점(보통 노드 중심)을 포함하는 그룹의 id 를 반환. 없으면 null.
 * 여러 그룹에 겹쳐 있으면 가장 작은(앞쪽) 그룹을 우선한다.
 */
export function findGroupForNode(
  nodes: CanvasFlowNode[],
  point: { x: number; y: number }
): string | null {
  const groups = nodes.filter((n) => n.type === 'groupNode')
  let best: { id: string; area: number } | null = null
  for (const g of groups) {
    const w = g.data.width
    const h = g.data.height
    const inside =
      point.x >= g.position.x &&
      point.x <= g.position.x + w &&
      point.y >= g.position.y &&
      point.y <= g.position.y + h
    if (!inside) continue
    const area = w * h
    if (!best || area < best.area) best = { id: g.id, area }
  }
  return best?.id ?? null
}
