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

/** 노드/그룹의 소속 그룹 id (둘 다 data.groupId 를 사용 — 그룹은 부모 그룹). */
export function getContainerId(node: CanvasFlowNode): string | null {
  return 'groupId' in node.data ? (node.data.groupId ?? null) : null
}

/**
 * 주어진 그룹의 모든 자손 id 집합(자식 노드 + 자식 그룹, 재귀). 자기 자신은 미포함.
 * 중첩 그룹 드래그 동반 이동 / 사이클 방지(자손을 부모로 못 삼게)에 사용.
 */
export function collectDescendantIds(nodes: CanvasFlowNode[], rootGroupId: string): Set<string> {
  const childrenOf = new Map<string, string[]>()
  for (const n of nodes) {
    const parent = getContainerId(n)
    if (!parent) continue
    const arr = childrenOf.get(parent)
    if (arr) arr.push(n.id)
    else childrenOf.set(parent, [n.id])
  }
  const result = new Set<string>()
  const stack = [...(childrenOf.get(rootGroupId) ?? [])]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (result.has(id)) continue
    result.add(id)
    const grandchildren = childrenOf.get(id)
    if (grandchildren) stack.push(...grandchildren)
  }
  return result
}

/**
 * 주어진 점(보통 노드 중심)을 포함하는 그룹의 id 를 반환. 없으면 null.
 * 여러 그룹에 겹쳐 있으면 가장 작은(앞쪽) 그룹을 우선한다.
 * excludeIds 에 든 그룹은 후보에서 제외 — 중첩 시 자기 자신/자손 그룹으로 편입되어
 * 사이클이 생기는 것을 방지한다.
 */
export function findGroupForNode(
  nodes: CanvasFlowNode[],
  point: { x: number; y: number },
  excludeIds?: Set<string>
): string | null {
  const groups = nodes.filter((n) => n.type === 'groupNode')
  let best: { id: string; area: number } | null = null
  for (const g of groups) {
    if (excludeIds?.has(g.id)) continue
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
