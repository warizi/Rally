/**
 * computeMinSizePx — 분할 트리의 하위 구성에 따라 최소 크기가 합산되는지.
 *
 * 배경 (2026-09 "패인 시스템에서 min width 안먹는 현상"): 모든 패널에 300px 를 일률 적용해서
 * 좌측(상단(좌, 우) 하단) 우측 구성에서 좌측 열이 하단 pane 하나 기준(300px)까지 줄어들었다.
 */
import { describe, it, expect } from 'vitest'
import type { LayoutNode, SplitNode } from '@/entities/tab-system'
import { computeMinSizePx, axisOfOrientation, paneMinPx, HANDLE_PX } from '../pane-min-size'

// 루트 16px 기준 pane 최소 = 18.75rem = 300px
const PANE_MIN_PX = paneMinPx(16)

const pane = (id: string): LayoutNode => ({ id, type: 'pane', paneId: id })
const split = (
  id: string,
  direction: 'horizontal' | 'vertical',
  children: LayoutNode[]
): SplitNode => ({ id, type: 'split', direction, children, sizes: children.map(() => 50) })

describe('computeMinSizePx', () => {
  it('pane 은 어느 축이든 PANE_MIN_PX', () => {
    expect(computeMinSizePx(pane('a'), 'width', PANE_MIN_PX)).toBe(PANE_MIN_PX)
    expect(computeMinSizePx(pane('a'), 'height', PANE_MIN_PX)).toBe(PANE_MIN_PX)
  })

  it('가로 분할은 width 를 합산(핸들 포함), height 는 최대값', () => {
    const n = split('s', 'horizontal', [pane('a'), pane('b')])
    expect(computeMinSizePx(n, 'width', PANE_MIN_PX)).toBe(PANE_MIN_PX * 2 + HANDLE_PX)
    expect(computeMinSizePx(n, 'height', PANE_MIN_PX)).toBe(PANE_MIN_PX)
  })

  it('세로 분할은 height 를 합산, width 는 최대값', () => {
    const n = split('s', 'vertical', [pane('a'), pane('b'), pane('c')])
    expect(computeMinSizePx(n, 'height', PANE_MIN_PX)).toBe(PANE_MIN_PX * 3 + HANDLE_PX * 2)
    expect(computeMinSizePx(n, 'width', PANE_MIN_PX)).toBe(PANE_MIN_PX)
  })

  it('사용자 사례: 좌측(상단(좌, 우) 하단) 우측 → 좌측 열 width 는 상단 가로 분할 기준', () => {
    const left = split('left', 'vertical', [
      split('top', 'horizontal', [pane('a'), pane('b')]),
      pane('bottom')
    ])
    const root = split('root', 'horizontal', [left, pane('right')])
    // 루트가 가로 분할 → 자식 패널의 축은 width
    expect(computeMinSizePx(left, axisOfOrientation('horizontal'), PANE_MIN_PX)).toBe(
      PANE_MIN_PX * 2 + HANDLE_PX
    )
    expect(computeMinSizePx(pane('right'), 'width', PANE_MIN_PX)).toBe(PANE_MIN_PX)
    // 루트 자체는 좌측 열(601) + 우측(300) + 핸들
    expect(computeMinSizePx(root, 'width', PANE_MIN_PX)).toBe(PANE_MIN_PX * 3 + HANDLE_PX * 2)
    // 좌측 열의 height 는 상단(300) + 하단(300) + 핸들
    expect(computeMinSizePx(left, 'height', PANE_MIN_PX)).toBe(PANE_MIN_PX * 2 + HANDLE_PX)
  })

  it('빈 split 은 pane 하나 기준으로 폴백', () => {
    expect(computeMinSizePx(split('s', 'horizontal', []), 'width', PANE_MIN_PX)).toBe(PANE_MIN_PX)
  })

  it('paneMinPx 는 루트 font-size 에 비례 — 글자 크기 13/15/17px 설정', () => {
    expect(paneMinPx(16)).toBe(300)
    expect(paneMinPx(13)).toBe(243.75)
    expect(paneMinPx(15)).toBe(281.25)
    expect(paneMinPx(17)).toBe(318.75)
  })
})
