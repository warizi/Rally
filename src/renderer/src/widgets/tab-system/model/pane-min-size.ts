import type { LayoutNode } from '@/entities/tab-system'

/** PaneContainer 의 `min-w-75 min-h-75` (= 300px) — pane 하나가 차지해야 하는 최소 크기. */
export const PANE_MIN_PX = 300
/** ResizableHandle 의 `w-px` / `h-px`. */
export const HANDLE_PX = 1

export type SizeAxis = 'width' | 'height'

/** ResizablePanelGroup orientation → 그 그룹의 자식 패널이 늘어나는 축. */
export function axisOfOrientation(orientation: 'horizontal' | 'vertical'): SizeAxis {
  return orientation === 'horizontal' ? 'width' : 'height'
}

/**
 * 레이아웃 노드가 `axis` 방향으로 필요로 하는 최소 픽셀.
 *
 * pane 은 PANE_MIN_PX. split 은 자식들의 최소값을 축에 따라 합산(같은 축으로 나뉜 경우, 핸들 폭 포함)
 * 하거나 최대값(수직 축으로 나뉜 경우)으로 올린다. 이전에는 모든 패널에 300px 를 일률 적용해서,
 * 예컨대 좌측 열의 상단이 좌/우로 갈라져 있어도 좌측 열이 pane 하나 기준(300px)까지 줄어들었다.
 */
export function computeMinSizePx(node: LayoutNode, axis: SizeAxis): number {
  if (node.type === 'pane') return PANE_MIN_PX
  const mins = node.children.map((child) => computeMinSizePx(child, axis))
  if (mins.length === 0) return PANE_MIN_PX
  const splitsAlongAxis =
    (node.direction === 'horizontal' && axis === 'width') ||
    (node.direction === 'vertical' && axis === 'height')
  if (splitsAlongAxis) {
    return mins.reduce((sum, m) => sum + m, 0) + HANDLE_PX * (mins.length - 1)
  }
  return Math.max(...mins)
}
