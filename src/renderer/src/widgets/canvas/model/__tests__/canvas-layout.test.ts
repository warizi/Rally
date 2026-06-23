import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import type { CanvasFlowNode } from '@entities/canvas'
import {
  findNonOverlappingPosition,
  findGroupForNode,
  collectDescendantIds,
  getContainerId
} from '../canvas-layout'

function makeNode(x: number, y: number): Node {
  return {
    id: `node-${x}-${y}`,
    position: { x, y },
    data: {}
  }
}

/** 그룹 박스 노드 (groupId = 부모 그룹) */
function group(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  groupId: string | null = null
): CanvasFlowNode {
  return {
    id,
    type: 'groupNode',
    position: { x, y },
    data: {
      canvasId: 'c',
      nodeType: 'group',
      label: null,
      color: null,
      width: w,
      height: h,
      groupId
    }
  } as unknown as CanvasFlowNode
}

/** 일반(텍스트) 노드 */
function leaf(id: string, x: number, y: number, groupId: string | null = null): CanvasFlowNode {
  return {
    id,
    type: 'textNode',
    position: { x, y },
    data: {
      canvasId: 'c',
      nodeType: 'text',
      label: '',
      content: '',
      color: null,
      width: 20,
      height: 20,
      groupId
    }
  } as unknown as CanvasFlowNode
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

describe('getContainerId', () => {
  it('그룹/노드 모두 data.groupId 를 소속으로 반환', () => {
    expect(getContainerId(group('g1', 0, 0, 100, 100, 'parent'))).toBe('parent')
    expect(getContainerId(leaf('n1', 0, 0, 'g1'))).toBe('g1')
    expect(getContainerId(leaf('n2', 0, 0, null))).toBeNull()
  })
})

describe('collectDescendantIds', () => {
  it('자식 노드 + 중첩 그룹과 그 멤버를 모두 수집(재귀)', () => {
    // outer ⊃ { inner, nodeA },  inner ⊃ { nodeB }
    const nodes = [
      group('outer', 0, 0, 500, 500, null),
      group('inner', 50, 50, 200, 200, 'outer'),
      leaf('nodeA', 10, 10, 'outer'),
      leaf('nodeB', 60, 60, 'inner'),
      leaf('orphan', 400, 400, null)
    ]
    const desc = collectDescendantIds(nodes, 'outer')
    expect(desc).toEqual(new Set(['inner', 'nodeA', 'nodeB']))
    expect(desc.has('orphan')).toBe(false)
    expect(desc.has('outer')).toBe(false)
  })

  it('사이클이 있어도 무한루프 없이 종료', () => {
    const nodes = [group('a', 0, 0, 10, 10, 'b'), group('b', 0, 0, 10, 10, 'a')]
    expect(() => collectDescendantIds(nodes, 'a')).not.toThrow()
  })
})

describe('findGroupForNode — 중첩/제외', () => {
  it('가장 작은(안쪽) 포함 그룹을 우선', () => {
    const nodes = [group('outer', 0, 0, 500, 500), group('inner', 100, 100, 100, 100)]
    expect(findGroupForNode(nodes, { x: 150, y: 150 })).toBe('inner')
    expect(findGroupForNode(nodes, { x: 20, y: 20 })).toBe('outer')
  })

  it('excludeIds 의 그룹은 후보에서 제외(사이클 방지)', () => {
    const nodes = [group('outer', 0, 0, 500, 500), group('inner', 100, 100, 100, 100, 'outer')]
    // inner 자신을 제외하면 점이 inner 안이어도 outer 로 판정
    expect(findGroupForNode(nodes, { x: 150, y: 150 }, new Set(['inner']))).toBe('outer')
    // outer/inner 모두 제외하면 null
    expect(findGroupForNode(nodes, { x: 150, y: 150 }, new Set(['inner', 'outer']))).toBeNull()
  })
})
