import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { findNonOverlappingPosition } from '../canvas-layout'

function makeNode(x: number, y: number): Node {
  return {
    id: `node-${x}-${y}`,
    position: { x, y },
    data: {}
  }
}

describe('findNonOverlappingPosition', () => {
  it('노드 없을 때 → baseX, baseY 그대로 반환', () => {
    const result = findNonOverlappingPosition([], 100, 200)
    expect(result).toEqual({ x: 100, y: 200 })
  })

  it('겹치지 않는 위치 → baseX, baseY 그대로 반환', () => {
    const nodes = [makeNode(500, 500)]
    const result = findNonOverlappingPosition(nodes, 100, 200)
    expect(result).toEqual({ x: 100, y: 200 })
  })

  it('겹치는 노드 1개 → offset 이동', () => {
    const nodes = [makeNode(100, 200)]
    const result = findNonOverlappingPosition(nodes, 100, 200)
    expect(result.x).toBeGreaterThan(100)
    expect(result.y).toBeGreaterThan(200)
  })

  it('연속 겹침 → offset 반복', () => {
    const nodes = [makeNode(100, 200), makeNode(130, 230), makeNode(160, 260)]
    const result = findNonOverlappingPosition(nodes, 100, 200)
    expect(result.x).toBeGreaterThan(160)
    expect(result.y).toBeGreaterThan(260)
  })

  it('20회 시도 후 포기 → 마지막 위치 반환', () => {
    // 모든 offset 위치에 노드 배치
    const nodes: Node[] = []
    for (let i = 0; i <= 20; i++) {
      nodes.push(makeNode(100 + i * 30, 200 + i * 30))
    }
    const result = findNonOverlappingPosition(nodes, 100, 200)
    expect(result.x).toBe(100 + 20 * 30)
    expect(result.y).toBe(200 + 20 * 30)
  })

  it('custom width/height → 겹침 판정에 반영', () => {
    const nodes = [makeNode(100, 200)]
    // 매우 큰 width/height → 더 넓은 범위에서 겹침 감지
    const result = findNonOverlappingPosition(nodes, 120, 220, 500, 500)
    expect(result.x).toBeGreaterThan(120)
    expect(result.y).toBeGreaterThan(220)
  })
})
