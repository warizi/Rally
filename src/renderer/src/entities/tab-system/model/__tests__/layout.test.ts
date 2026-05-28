import { describe, it, expect } from 'vitest'
import {
  findPaneNodeInLayout,
  findSplitNode,
  findFirstPaneId,
  isContainsNode,
  replaceNodeInLayout,
  findRightPaneInHorizontalSplit,
  insertPaneIntoLayout,
  removePaneFromLayout,
  updateSizesInLayout,
  removeAndNormalizeSizes,
  cleanupLayout,
  findAdjacentPaneId
} from '../layout'
import type { PaneNode, SplitNode } from '@/entities/tab-system'

// ─── 헬퍼 ─────────────────────────────────────────────
function paneNode(nodeId: string, paneId: string): PaneNode {
  return { id: nodeId, type: 'pane', paneId }
}

function splitNode(
  id: string,
  direction: 'horizontal' | 'vertical',
  children: (PaneNode | SplitNode)[],
  sizes?: number[]
): SplitNode {
  return {
    id,
    type: 'split',
    direction,
    children,
    sizes: sizes ?? children.map(() => 100 / children.length)
  }
}

// ─── findPaneNodeInLayout ─────────────────────────────
describe('findPaneNodeInLayout', () => {
  it('단순 PaneNode에서 paneId로 찾는다', () => {
    const layout = paneNode('n1', 'pane-1')
    expect(findPaneNodeInLayout(layout, 'pane-1')?.paneId).toBe('pane-1')
  })

  it('존재하지 않는 paneId면 null을 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    expect(findPaneNodeInLayout(layout, 'pane-x')).toBeNull()
  })

  it('SplitNode 안에서 중첩 탐색한다', () => {
    const layout = splitNode('s1', 'horizontal', [
      paneNode('n1', 'pane-1'),
      paneNode('n2', 'pane-2')
    ])
    expect(findPaneNodeInLayout(layout, 'pane-2')?.paneId).toBe('pane-2')
  })

  it('깊게 중첩된 레이아웃에서도 찾는다', () => {
    const inner = splitNode('s2', 'vertical', [paneNode('n2', 'pane-2'), paneNode('n3', 'pane-3')])
    const layout = splitNode('s1', 'horizontal', [paneNode('n1', 'pane-1'), inner])
    expect(findPaneNodeInLayout(layout, 'pane-3')?.paneId).toBe('pane-3')
  })
})

// ─── removeAndNormalizeSizes ──────────────────────────
describe('removeAndNormalizeSizes', () => {
  it('첫 번째 요소를 제거하고 합이 100이 되도록 정규화한다', () => {
    const result = removeAndNormalizeSizes([50, 50], 0)
    expect(result).toHaveLength(1)
    expect(result[0]).toBeCloseTo(100)
  })

  it('가운데 요소를 제거하고 합이 100이 되도록 정규화한다', () => {
    const result = removeAndNormalizeSizes([33.33, 33.33, 33.34], 1)
    expect(result).toHaveLength(2)
    expect(result[0] + result[1]).toBeCloseTo(100)
  })

  it('마지막 요소를 제거한다', () => {
    const result = removeAndNormalizeSizes([40, 60], 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toBeCloseTo(100)
  })
})

// ─── insertPaneIntoLayout ─────────────────────────────
describe('insertPaneIntoLayout', () => {
  it('단일 패인에 오른쪽 삽입 → horizontal SplitNode 생성', () => {
    const layout = paneNode('n1', 'pane-1')
    const newLayout = insertPaneIntoLayout(layout, 'pane-1', 'pane-2', 'right') as SplitNode

    expect(newLayout.type).toBe('split')
    expect(newLayout.direction).toBe('horizontal')
    expect(newLayout.children).toHaveLength(2)
  })

  it('왼쪽 삽입 시 새 패인이 첫 번째 자식이 된다', () => {
    const layout = paneNode('n1', 'pane-1')
    const newLayout = insertPaneIntoLayout(layout, 'pane-1', 'pane-2', 'left') as SplitNode

    const firstChild = newLayout.children[0] as PaneNode
    expect(firstChild.paneId).toBe('pane-2')
  })

  it('오른쪽 삽입 시 새 패인이 두 번째 자식이 된다', () => {
    const layout = paneNode('n1', 'pane-1')
    const newLayout = insertPaneIntoLayout(layout, 'pane-1', 'pane-2', 'right') as SplitNode

    const secondChild = newLayout.children[1] as PaneNode
    expect(secondChild.paneId).toBe('pane-2')
  })

  it('아래 삽입 → vertical SplitNode 생성', () => {
    const layout = paneNode('n1', 'pane-1')
    const newLayout = insertPaneIntoLayout(layout, 'pane-1', 'pane-2', 'bottom') as SplitNode

    expect(newLayout.direction).toBe('vertical')
  })

  it('위 삽입 → vertical SplitNode, 새 패인이 첫 번째 자식', () => {
    const layout = paneNode('n1', 'pane-1')
    const newLayout = insertPaneIntoLayout(layout, 'pane-1', 'pane-2', 'top') as SplitNode

    expect(newLayout.type).toBe('split')
    expect(newLayout.direction).toBe('vertical')
    const firstChild = newLayout.children[0] as PaneNode
    expect(firstChild.paneId).toBe('pane-2')
  })

  it('같은 방향의 SplitNode에 자식으로 추가한다', () => {
    const layout = splitNode(
      's1',
      'horizontal',
      [paneNode('n1', 'pane-1'), paneNode('n2', 'pane-2')],
      [50, 50]
    )
    const newLayout = insertPaneIntoLayout(layout, 'pane-2', 'pane-3', 'right') as SplitNode

    expect(newLayout.children).toHaveLength(3)
  })

  it('존재하지 않는 targetPaneId면 레이아웃을 그대로 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    const result = insertPaneIntoLayout(layout, 'pane-x', 'pane-2', 'right')
    expect(result).toBe(layout)
  })
})

// ─── removePaneFromLayout ─────────────────────────────
describe('removePaneFromLayout', () => {
  it('SplitNode에서 패인 제거 후 자식이 1개 남으면 SplitNode를 풀어 PaneNode를 반환한다', () => {
    const layout = splitNode('s1', 'horizontal', [
      paneNode('n1', 'pane-1'),
      paneNode('n2', 'pane-2')
    ])
    const newLayout = removePaneFromLayout(layout, 'pane-1')

    expect(newLayout.type).toBe('pane')
    expect((newLayout as PaneNode).paneId).toBe('pane-2')
  })

  it('3개 중 하나 제거 → 2개 자식 SplitNode', () => {
    const layout = splitNode(
      's1',
      'horizontal',
      [paneNode('n1', 'pane-1'), paneNode('n2', 'pane-2'), paneNode('n3', 'pane-3')],
      [33.33, 33.33, 33.34]
    )
    const newLayout = removePaneFromLayout(layout, 'pane-2') as SplitNode

    expect(newLayout.children).toHaveLength(2)
    const paneIds = (newLayout.children as PaneNode[]).map((c) => c.paneId)
    expect(paneIds).toContain('pane-1')
    expect(paneIds).toContain('pane-3')
  })

  it('존재하지 않는 paneId면 레이아웃을 그대로 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    const result = removePaneFromLayout(layout, 'pane-x')
    expect(result).toBe(layout)
  })

  it('루트 PaneNode를 제거하려 하면 (부모 없음) 레이아웃을 그대로 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    const result = removePaneFromLayout(layout, 'pane-1')
    expect(result).toBe(layout)
  })

  it('제거 후 sizes를 정규화한다', () => {
    const layout = splitNode(
      's1',
      'horizontal',
      [paneNode('n1', 'pane-1'), paneNode('n2', 'pane-2'), paneNode('n3', 'pane-3')],
      [20, 30, 50]
    )
    const newLayout = removePaneFromLayout(layout, 'pane-1') as SplitNode

    const sum = newLayout.sizes.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(100)
  })
})

// ─── updateSizesInLayout ─────────────────────────────
describe('updateSizesInLayout', () => {
  it('지정한 SplitNode의 sizes를 업데이트한다', () => {
    const layout = splitNode(
      's1',
      'horizontal',
      [paneNode('n1', 'pane-1'), paneNode('n2', 'pane-2')],
      [50, 50]
    )
    const newLayout = updateSizesInLayout(layout, 's1', [70, 30]) as SplitNode

    expect(newLayout.sizes).toEqual([70, 30])
  })

  it('PaneNode에 적용하면 그대로 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    expect(updateSizesInLayout(layout, 'n1', [100])).toBe(layout)
  })

  it('존재하지 않는 nodeId면 레이아웃을 변경하지 않는다', () => {
    const layout = splitNode('s1', 'horizontal', [paneNode('n1', 'pane-1')], [100])
    const newLayout = updateSizesInLayout(layout, 'x-x', [60, 40]) as SplitNode
    expect(newLayout.sizes).toEqual([100])
  })
})

// ─── findRightPaneInHorizontalSplit ───────────────────
describe('findRightPaneInHorizontalSplit', () => {
  it('수평 분할에서 타깃 노드의 오른쪽 패인 ID를 반환한다', () => {
    const left = paneNode('n1', 'pane-1')
    const right = paneNode('n2', 'pane-2')
    const layout = splitNode('s1', 'horizontal', [left, right])

    expect(findRightPaneInHorizontalSplit(layout, 'n1')).toBe('pane-2')
  })

  it('가장 오른쪽 노드이면 null을 반환한다', () => {
    const layout = splitNode('s1', 'horizontal', [
      paneNode('n1', 'pane-1'),
      paneNode('n2', 'pane-2')
    ])
    expect(findRightPaneInHorizontalSplit(layout, 'n2')).toBeNull()
  })

  it('수직 분할이면 null을 반환한다', () => {
    const layout = splitNode('s1', 'vertical', [paneNode('n1', 'pane-1'), paneNode('n2', 'pane-2')])
    expect(findRightPaneInHorizontalSplit(layout, 'n1')).toBeNull()
  })

  it('단순 PaneNode이면 null을 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    expect(findRightPaneInHorizontalSplit(layout, 'n1')).toBeNull()
  })
})

// ─── cleanupLayout ────────────────────────────────────
describe('cleanupLayout', () => {
  it('PaneNode는 그대로 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    expect(cleanupLayout(layout)).toBe(layout)
  })

  it('자식이 1개 남은 SplitNode를 자식으로 대체한다', () => {
    const child = paneNode('n1', 'pane-1')
    const layout = splitNode('s1', 'horizontal', [child])
    const result = cleanupLayout(layout)

    expect(result.type).toBe('pane')
    expect((result as PaneNode).paneId).toBe('pane-1')
  })

  it('자식이 2개 이상이면 SplitNode를 유지하며 sizes를 정규화한다', () => {
    const layout = splitNode(
      's1',
      'horizontal',
      [paneNode('n1', 'pane-1'), paneNode('n2', 'pane-2')],
      [50, 50]
    )
    const result = cleanupLayout(layout) as SplitNode
    expect(result.type).toBe('split')
    expect(result.children).toHaveLength(2)
  })
})

// ─── findFirstPaneId ──────────────────────────────────
describe('findFirstPaneId', () => {
  it('PaneNode에서 paneId를 반환한다', () => {
    expect(findFirstPaneId(paneNode('n1', 'pane-1'))).toBe('pane-1')
  })

  it('SplitNode에서 가장 첫 번째 PaneNode의 paneId를 반환한다', () => {
    const layout = splitNode('s1', 'horizontal', [
      paneNode('n1', 'pane-1'),
      paneNode('n2', 'pane-2')
    ])
    expect(findFirstPaneId(layout)).toBe('pane-1')
  })

  it('깊게 중첩된 레이아웃에서 첫 번째 paneId를 반환한다', () => {
    const inner = splitNode('s2', 'vertical', [paneNode('n2', 'pane-2'), paneNode('n3', 'pane-3')])
    const layout = splitNode('s1', 'horizontal', [inner, paneNode('n1', 'pane-1')])
    expect(findFirstPaneId(layout)).toBe('pane-2')
  })
})

// ─── isContainsNode ───────────────────────────────────
describe('isContainsNode', () => {
  it('자기 자신의 id를 포함한다', () => {
    const layout = paneNode('n1', 'pane-1')
    expect(isContainsNode(layout, 'n1')).toBe(true)
  })

  it('자식 노드 id를 포함한다', () => {
    const layout = splitNode('s1', 'horizontal', [
      paneNode('n1', 'pane-1'),
      paneNode('n2', 'pane-2')
    ])
    expect(isContainsNode(layout, 'n1')).toBe(true)
    expect(isContainsNode(layout, 'n2')).toBe(true)
  })

  it('포함되지 않는 id면 false를 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    expect(isContainsNode(layout, 'n-x')).toBe(false)
  })

  it('깊이 중첩된 노드도 찾는다', () => {
    const inner = splitNode('s2', 'vertical', [paneNode('n2', 'pane-2'), paneNode('n3', 'pane-3')])
    const layout = splitNode('s1', 'horizontal', [paneNode('n1', 'pane-1'), inner])
    expect(isContainsNode(layout, 'n3')).toBe(true)
  })
})

// ─── findSplitNode ────────────────────────────────────
describe('findSplitNode', () => {
  it('SplitNode의 첫 번째 자식을 찾으면 index 0을 반환한다', () => {
    const child1 = paneNode('n1', 'pane-1')
    const child2 = paneNode('n2', 'pane-2')
    const layout = splitNode('s1', 'horizontal', [child1, child2])

    const result = findSplitNode(layout, 'n1')
    expect(result).not.toBeNull()
    expect(result?.parent.id).toBe('s1')
    expect(result?.index).toBe(0)
  })

  it('두 번째 자식이면 index 1을 반환한다', () => {
    const child1 = paneNode('n1', 'pane-1')
    const child2 = paneNode('n2', 'pane-2')
    const layout = splitNode('s1', 'horizontal', [child1, child2])

    expect(findSplitNode(layout, 'n2')?.index).toBe(1)
  })

  it('PaneNode에서는 null을 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    expect(findSplitNode(layout, 'n1')).toBeNull()
  })

  it('존재하지 않는 nodeId면 null을 반환한다', () => {
    const layout = splitNode('s1', 'horizontal', [paneNode('n1', 'pane-1')])
    expect(findSplitNode(layout, 'n-x')).toBeNull()
  })
})

// ─── replaceNodeInLayout ──────────────────────────────
describe('replaceNodeInLayout', () => {
  it('루트 노드를 새 노드로 교체한다', () => {
    const layout = paneNode('n1', 'pane-1')
    const newNode = paneNode('n2', 'pane-2')

    const result = replaceNodeInLayout(layout, 'n1', newNode) as PaneNode
    expect(result.id).toBe('n2')
    expect(result.paneId).toBe('pane-2')
  })

  it('SplitNode 안의 자식을 교체한다', () => {
    const child1 = paneNode('n1', 'pane-1')
    const child2 = paneNode('n2', 'pane-2')
    const layout = splitNode('s1', 'horizontal', [child1, child2])

    const newChild = paneNode('n3', 'pane-3')
    const result = replaceNodeInLayout(layout, 'n1', newChild) as SplitNode

    const first = result.children[0] as PaneNode
    expect(first.paneId).toBe('pane-3')
    // 두 번째 자식은 변경되지 않아야 함
    expect((result.children[1] as PaneNode).paneId).toBe('pane-2')
  })

  it('존재하지 않는 nodeId면 레이아웃을 그대로 반환한다', () => {
    const layout = paneNode('n1', 'pane-1')
    const result = replaceNodeInLayout(layout, 'n-x', paneNode('n2', 'pane-2'))
    expect(result).toBe(layout)
  })
})

// ─── findAdjacentPaneId ───────────────────────────────
describe('findAdjacentPaneId', () => {
  it('단일 PaneNode 는 인접 pane 없음 → null', () => {
    const layout = paneNode('n1', 'pane-1')
    expect(findAdjacentPaneId(layout, 'pane-1', 'left')).toBeNull()
    expect(findAdjacentPaneId(layout, 'pane-1', 'right')).toBeNull()
  })

  it('horizontal split [L, R] 에서 좌측 → right 이동', () => {
    const layout = splitNode('s1', 'horizontal', [paneNode('n1', 'L'), paneNode('n2', 'R')])
    expect(findAdjacentPaneId(layout, 'L', 'right')).toBe('R')
    expect(findAdjacentPaneId(layout, 'R', 'left')).toBe('L')
  })

  it('horizontal split 양 끝 → 더 갈 곳 없음', () => {
    const layout = splitNode('s1', 'horizontal', [paneNode('n1', 'L'), paneNode('n2', 'R')])
    expect(findAdjacentPaneId(layout, 'L', 'left')).toBeNull()
    expect(findAdjacentPaneId(layout, 'R', 'right')).toBeNull()
  })

  it('horizontal split 에서 up/down 은 매칭 안 됨 → null', () => {
    const layout = splitNode('s1', 'horizontal', [paneNode('n1', 'L'), paneNode('n2', 'R')])
    expect(findAdjacentPaneId(layout, 'L', 'down')).toBeNull()
    expect(findAdjacentPaneId(layout, 'L', 'up')).toBeNull()
  })

  it('vertical split [T, B] 에서 위 → down', () => {
    const layout = splitNode('s1', 'vertical', [paneNode('n1', 'T'), paneNode('n2', 'B')])
    expect(findAdjacentPaneId(layout, 'T', 'down')).toBe('B')
    expect(findAdjacentPaneId(layout, 'B', 'up')).toBe('T')
  })

  it('중첩: outer horizontal [L, inner-vertical[TR, BR]] — TR 에서 left → L', () => {
    const layout = splitNode('s1', 'horizontal', [
      paneNode('n1', 'L'),
      splitNode('s2', 'vertical', [paneNode('n2', 'TR'), paneNode('n3', 'BR')])
    ])
    expect(findAdjacentPaneId(layout, 'TR', 'left')).toBe('L')
    expect(findAdjacentPaneId(layout, 'BR', 'left')).toBe('L')
  })

  it('중첩: L 에서 right → 우측 split 의 first leaf (TR)', () => {
    const layout = splitNode('s1', 'horizontal', [
      paneNode('n1', 'L'),
      splitNode('s2', 'vertical', [paneNode('n2', 'TR'), paneNode('n3', 'BR')])
    ])
    expect(findAdjacentPaneId(layout, 'L', 'right')).toBe('TR')
  })

  it('중첩: 안쪽 vertical 에서 down 은 vertical split 매칭 → BR', () => {
    const layout = splitNode('s1', 'horizontal', [
      paneNode('n1', 'L'),
      splitNode('s2', 'vertical', [paneNode('n2', 'TR'), paneNode('n3', 'BR')])
    ])
    expect(findAdjacentPaneId(layout, 'TR', 'down')).toBe('BR')
  })

  it('2x2 grid (outer horizontal, inner vertical 양쪽) 에서 모든 4방향', () => {
    const layout = splitNode('s1', 'horizontal', [
      splitNode('s2', 'vertical', [paneNode('n1', 'TL'), paneNode('n2', 'BL')]),
      splitNode('s3', 'vertical', [paneNode('n3', 'TR'), paneNode('n4', 'BR')])
    ])
    // TL 기준
    expect(findAdjacentPaneId(layout, 'TL', 'right')).toBe('TR')
    expect(findAdjacentPaneId(layout, 'TL', 'down')).toBe('BL')
    expect(findAdjacentPaneId(layout, 'TL', 'left')).toBeNull()
    expect(findAdjacentPaneId(layout, 'TL', 'up')).toBeNull()
    // BR 기준
    expect(findAdjacentPaneId(layout, 'BR', 'left')).toBe('BL')
    expect(findAdjacentPaneId(layout, 'BR', 'up')).toBe('TR')
  })

  it('currentPaneId 가 트리에 없으면 null', () => {
    const layout = splitNode('s1', 'horizontal', [paneNode('n1', 'L'), paneNode('n2', 'R')])
    expect(findAdjacentPaneId(layout, 'unknown', 'right')).toBeNull()
  })
})
