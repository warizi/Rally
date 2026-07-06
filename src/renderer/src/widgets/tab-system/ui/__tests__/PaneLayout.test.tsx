/**
 * widgets/tab-system/ui/PaneLayout.test.tsx
 *
 * layout 트리 재귀 렌더 — pane 노드는 PaneContainer로,
 * split 노드는 ResizablePanelGroup 내부에 자식.
 * topLeftPaneId 는 좌상단 첫 pane.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

type FakeNode =
  | { id: string; type: 'pane'; paneId: string }
  | {
      id: string
      type: 'split'
      direction: 'horizontal' | 'vertical'
      sizes: number[]
      children: FakeNode[]
    }

const mocks = vi.hoisted(() => ({
  layout: { id: 'root', type: 'pane', paneId: 'p1' } as FakeNode,
  updateLayoutSizes: vi.fn(),
  receivedPaneIds: [] as string[],
  receivedShowTrigger: [] as boolean[],
  receivedIsRightEdge: [] as boolean[]
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: (
    sel: (s: { layout: FakeNode; updateLayoutSizes: typeof mocks.updateLayoutSizes }) => unknown
  ) => sel({ layout: mocks.layout, updateLayoutSizes: mocks.updateLayoutSizes })
}))

vi.mock('@/entities/tab-system/model/types', () => ({
  isPaneNode: (n: FakeNode) => n.type === 'pane',
  isSplitContainerNode: (n: FakeNode) => n.type === 'split'
}))

vi.mock('../PaneContainer', () => ({
  PaneContainer: ({
    paneId,
    showSidebarTrigger,
    isRightEdge
  }: {
    paneId: string
    showSidebarTrigger: boolean
    isRightEdge: boolean
  }) => {
    mocks.receivedPaneIds.push(paneId)
    mocks.receivedShowTrigger.push(showSidebarTrigger)
    mocks.receivedIsRightEdge.push(isRightEdge)
    return <div data-testid={`pane-${paneId}`} />
  }
}))

vi.mock('@/shared/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="panel-group">{children}</div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div data-testid="resize-handle" />
}))

import { PaneLayout } from '../PaneLayout'

beforeEach(() => {
  mocks.layout = { id: 'root', type: 'pane', paneId: 'p1' }
  mocks.receivedPaneIds.length = 0
  mocks.receivedShowTrigger.length = 0
  mocks.receivedIsRightEdge.length = 0
})

function isRightEdgeOf(paneId: string): boolean {
  return mocks.receivedIsRightEdge[mocks.receivedPaneIds.indexOf(paneId)]
}

describe('PaneLayout', () => {
  it('단일 pane 트리 → PaneContainer 1개 + showSidebarTrigger=true (topLeft)', () => {
    render(<PaneLayout routes={[]} />)
    expect(screen.getByTestId('pane-p1')).toBeInTheDocument()
    expect(mocks.receivedShowTrigger[0]).toBe(true)
  })

  it('split horizontal 트리 → 2 pane + resize handle', () => {
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'horizontal',
      sizes: [50, 50],
      children: [
        { id: 'a', type: 'pane', paneId: 'pA' },
        { id: 'b', type: 'pane', paneId: 'pB' }
      ]
    }
    render(<PaneLayout routes={[]} />)
    expect(screen.getByTestId('pane-pA')).toBeInTheDocument()
    expect(screen.getByTestId('pane-pB')).toBeInTheDocument()
    expect(screen.getByTestId('resize-handle')).toBeInTheDocument()
    expect(screen.getByTestId('panel-group')).toBeInTheDocument()
    // topLeft = pA
    const pAIdx = mocks.receivedPaneIds.indexOf('pA')
    const pBIdx = mocks.receivedPaneIds.indexOf('pB')
    expect(mocks.receivedShowTrigger[pAIdx]).toBe(true)
    expect(mocks.receivedShowTrigger[pBIdx]).toBe(false)
  })

  it('nested split → 모든 pane 노출', () => {
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'vertical',
      sizes: [60, 40],
      children: [
        { id: 'top', type: 'pane', paneId: 'pT' },
        {
          id: 'bot',
          type: 'split',
          direction: 'horizontal',
          sizes: [50, 50],
          children: [
            { id: 'bl', type: 'pane', paneId: 'pBL' },
            { id: 'br', type: 'pane', paneId: 'pBR' }
          ]
        }
      ]
    }
    render(<PaneLayout routes={[]} />)
    expect(screen.getByTestId('pane-pT')).toBeInTheDocument()
    expect(screen.getByTestId('pane-pBL')).toBeInTheDocument()
    expect(screen.getByTestId('pane-pBR')).toBeInTheDocument()
  })

  it('isDragging prop → PaneContainer 까지 전달 (smoke)', () => {
    render(<PaneLayout routes={[]} isDragging={true} />)
    expect(screen.getByTestId('pane-p1')).toBeInTheDocument()
  })

  it('nested split topLeft → 최좌상단 pane 만 showSidebarTrigger=true', () => {
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'vertical',
      sizes: [60, 40],
      children: [
        { id: 'top', type: 'pane', paneId: 'pT' },
        {
          id: 'bot',
          type: 'split',
          direction: 'horizontal',
          sizes: [50, 50],
          children: [
            { id: 'bl', type: 'pane', paneId: 'pBL' },
            { id: 'br', type: 'pane', paneId: 'pBR' }
          ]
        }
      ]
    }
    render(<PaneLayout routes={[]} />)
    // topLeft 는 pT
    const trueCount = mocks.receivedShowTrigger.filter((v) => v === true).length
    expect(trueCount).toBe(1)
  })

  it('vertical split → ResizableHandle 노출', () => {
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'vertical',
      sizes: [50, 50],
      children: [
        { id: 'a', type: 'pane', paneId: 'pA' },
        { id: 'b', type: 'pane', paneId: 'pB' }
      ]
    }
    render(<PaneLayout routes={[]} />)
    expect(screen.getByTestId('resize-handle')).toBeInTheDocument()
  })

  // isRightEdge — win32 캡션 버튼(WCO) 겹침 회피용 전파 (isTopRow 와 대칭)
  it('단일 pane → isRightEdge=true', () => {
    render(<PaneLayout routes={[]} />)
    expect(isRightEdgeOf('p1')).toBe(true)
  })

  it('horizontal split → 우측 pane 만 isRightEdge=true', () => {
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'horizontal',
      sizes: [50, 50],
      children: [
        { id: 'a', type: 'pane', paneId: 'pA' },
        { id: 'b', type: 'pane', paneId: 'pB' }
      ]
    }
    render(<PaneLayout routes={[]} />)
    expect(isRightEdgeOf('pA')).toBe(false)
    expect(isRightEdgeOf('pB')).toBe(true)
  })

  it('vertical split → 위/아래 pane 모두 isRightEdge=true', () => {
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'vertical',
      sizes: [50, 50],
      children: [
        { id: 'a', type: 'pane', paneId: 'pA' },
        { id: 'b', type: 'pane', paneId: 'pB' }
      ]
    }
    render(<PaneLayout routes={[]} />)
    expect(isRightEdgeOf('pA')).toBe(true)
    expect(isRightEdgeOf('pB')).toBe(true)
  })

  it('nested: horizontal 좌측의 vertical split → 모두 isRightEdge=false', () => {
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'horizontal',
      sizes: [50, 50],
      children: [
        {
          id: 'left',
          type: 'split',
          direction: 'vertical',
          sizes: [50, 50],
          children: [
            { id: 'lt', type: 'pane', paneId: 'pLT' },
            { id: 'lb', type: 'pane', paneId: 'pLB' }
          ]
        },
        { id: 'right', type: 'pane', paneId: 'pR' }
      ]
    }
    render(<PaneLayout routes={[]} />)
    expect(isRightEdgeOf('pLT')).toBe(false)
    expect(isRightEdgeOf('pLB')).toBe(false)
    expect(isRightEdgeOf('pR')).toBe(true)
  })

  it('빈 split (children 없음) → findTopLeftPaneId null fallback (smoke)', () => {
    mocks.layout = {
      id: 'r',
      type: 'split',
      direction: 'horizontal',
      sizes: [],
      children: []
    }
    // 빈 children 으로 렌더 시도 → 에러 없이 panel-group 만 나옴
    render(<PaneLayout routes={[]} />)
    expect(screen.getByTestId('panel-group')).toBeInTheDocument()
  })
})
