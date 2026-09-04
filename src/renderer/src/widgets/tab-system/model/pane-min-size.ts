import type { LayoutNode } from '@/entities/tab-system'

/**
 * PaneContainer 의 `min-w-75 min-h-75` — Tailwind spacing 75 = 18.75rem.
 * rem 이라 설정의 글자 크기(루트 font-size 13/15/17px)에 따라 243.75 / 281.25 / 318.75px 로 바뀐다.
 * react-resizable-panels 의 minSize 는 px 만 받으므로 같은 루트 font-size 로 환산해서 넘겨야
 * 패널 최소값과 PaneContainer 최소값이 어긋나지 않는다 (어긋나면 패널 안 overflow:auto 래퍼에
 * 그 차이만큼 가로 스크롤이 생긴다).
 */
export const PANE_MIN_REM = 18.75
/** ResizableHandle 의 `w-px` / `h-px`. */
export const HANDLE_PX = 1

export type SizeAxis = 'width' | 'height'

/** 루트 font-size(px) 기준 pane 하나의 최소 px. */
export function paneMinPx(rootFontPx: number): number {
  return PANE_MIN_REM * rootFontPx
}

/** ResizablePanelGroup orientation → 그 그룹의 자식 패널이 늘어나는 축. */
export function axisOfOrientation(orientation: 'horizontal' | 'vertical'): SizeAxis {
  return orientation === 'horizontal' ? 'width' : 'height'
}

/**
 * 레이아웃 노드가 `axis` 방향으로 필요로 하는 최소 픽셀.
 *
 * pane 은 paneMin. split 은 자식들의 최소값을 축에 따라 합산(같은 축으로 나뉜 경우, 핸들 폭 포함)
 * 하거나 최대값(수직 축으로 나뉜 경우)으로 올린다. 이전에는 모든 패널에 300px 를 일률 적용해서,
 * 예컨대 좌측 열의 상단이 좌/우로 갈라져 있어도 좌측 열이 pane 하나 기준까지 줄어들었다.
 */
export function computeMinSizePx(node: LayoutNode, axis: SizeAxis, paneMin: number): number {
  if (node.type === 'pane') return paneMin
  const mins = node.children.map((child) => computeMinSizePx(child, axis, paneMin))
  if (mins.length === 0) return paneMin
  const splitsAlongAxis =
    (node.direction === 'horizontal' && axis === 'width') ||
    (node.direction === 'vertical' && axis === 'height')
  if (splitsAlongAxis) {
    return mins.reduce((sum, m) => sum + m, 0) + HANDLE_PX * (mins.length - 1)
  }
  return Math.max(...mins)
}
