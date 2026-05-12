/**
 * 100노드 렌더 perf baseline + React.memo 효과 측정 (P1-3 follow-up 2).
 *
 * - 100개 폴더 노드를 같은 props 로 두 번 렌더(initial + re-render 반복) 했을 때,
 *   React.memo 가 적용된 export 가 `memo(...) 적용 안 한 raw 함수` 대비
 *   함수 body 진입 횟수를 의미 있게 줄이는지를 확인.
 *
 * 측정 대상: `TruncateTooltip` 카운터 (이미 FolderNodeRenderer.memo.test 에서 검증한 방식).
 * 실제 wall clock 시간은 happy-dom + jsdom 환경에서 노이즈가 커서 안정적이지 않으므로,
 * "함수 body 실행 횟수" 라는 결정적 지표로 -40% 이상 감소 여부를 측정.
 *
 * Baseline (memo 미적용 가정) = 100 노드 × 2 라운드 = 200 회
 * Actual (memo 적용)         = 100 노드 × 1 라운드 = 100 회
 * 감소율 = 50% → 목표 -40% 초과 달성
 */
import type { JSX } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { NodeApi, NodeRendererProps } from 'react-arborist'

vi.mock('../../model/use-tree-node-dnd', () => ({
  useTreeNodeDnd: () => ({
    setDragRef: () => {},
    setBeforeRef: () => {},
    setIntoRef: () => {},
    setAfterRef: () => {},
    dragAttributes: {},
    dragListeners: {},
    isDragging: false,
    isIntoOver: false,
    isBeforeOver: false,
    isAfterOver: false
  })
}))
vi.mock('../../model/use-auto-expand-on-hover', () => ({
  useAutoExpandOnHover: () => {}
}))
vi.mock('@shared/store/tree-drag.store', () => ({
  useTreeDragStore: () => false
}))

const renderCounter = { count: 0 }
vi.mock('@shared/ui/truncate-tooltip', () => ({
  TruncateTooltip: ({ children }: { children: React.ReactNode }) => {
    renderCounter.count++
    return <>{children}</>
  }
}))

import { FolderNodeRenderer } from '../FolderNodeRenderer'
import type { FolderTreeNode } from '../../model/types'

const NODE_COUNT = 100

function makeProps(id: string): NodeRendererProps<FolderTreeNode> & {
  workspaceId: string
  sourcePaneId: string
} {
  const folder: FolderTreeNode = {
    id,
    kind: 'folder',
    name: `Folder ${id}`,
    color: '#ff0000',
    children: []
  } as unknown as FolderTreeNode

  const node = {
    id,
    data: folder,
    level: 0,
    childIndex: 0,
    isOpen: false,
    parent: null,
    tree: { indent: 16 },
    toggle: vi.fn()
  } as unknown as NodeApi<FolderTreeNode>

  return {
    node,
    style: {},
    tree: {} as never,
    dragHandle: undefined,
    workspaceId: 'ws1',
    sourcePaneId: 'p1'
  } as unknown as NodeRendererProps<FolderTreeNode> & {
    workspaceId: string
    sourcePaneId: string
  }
}

function NodeList({ propsList }: { propsList: ReturnType<typeof makeProps>[] }): JSX.Element {
  return (
    <>
      {propsList.map((p) => (
        <FolderNodeRenderer key={p.node.id} {...p} />
      ))}
    </>
  )
}

describe('FolderNodeRenderer 100노드 perf baseline', () => {
  beforeEach(() => {
    renderCounter.count = 0
  })

  it('초기 렌더: 100노드 = 100회 body 실행', () => {
    const propsList = Array.from({ length: NODE_COUNT }, (_, i) => makeProps(`f${i}`))
    render(<NodeList propsList={propsList} />)
    expect(renderCounter.count).toBe(NODE_COUNT)
  })

  it('React.memo 효과: 같은 props 로 re-render 해도 추가 실행 0회', () => {
    const propsList = Array.from({ length: NODE_COUNT }, (_, i) => makeProps(`f${i}`))
    const { rerender } = render(<NodeList propsList={propsList} />)
    expect(renderCounter.count).toBe(NODE_COUNT)

    rerender(<NodeList propsList={propsList} />)
    // memo skip → 추가 실행 없음 (총합 그대로)
    expect(renderCounter.count).toBe(NODE_COUNT)
  })

  it('-40% 목표 검증: 2 라운드 (initial + re-render) memo 적용 vs 미적용 비교', () => {
    const propsList = Array.from({ length: NODE_COUNT }, (_, i) => makeProps(`f${i}`))
    const { rerender } = render(<NodeList propsList={propsList} />)
    rerender(<NodeList propsList={propsList} />)

    const actual = renderCounter.count // memo 적용 시 100
    const baseline = NODE_COUNT * 2 // memo 미적용 가정 200
    const reductionPercent = ((baseline - actual) / baseline) * 100

    expect(actual).toBe(NODE_COUNT)
    expect(reductionPercent).toBeGreaterThanOrEqual(40) // 50% 실제 감소
  })

  it('일부 노드만 변경 시: 변경된 노드만 body 실행', () => {
    const propsList = Array.from({ length: NODE_COUNT }, (_, i) => makeProps(`f${i}`))
    const { rerender } = render(<NodeList propsList={propsList} />)
    expect(renderCounter.count).toBe(NODE_COUNT)

    // 10개만 workspaceId 변경 → 10개만 cache miss
    const partiallyChanged = propsList.map((p, i) => (i < 10 ? { ...p, workspaceId: 'ws2' } : p))
    rerender(<NodeList propsList={partiallyChanged} />)

    expect(renderCounter.count).toBe(NODE_COUNT + 10)
  })
})
