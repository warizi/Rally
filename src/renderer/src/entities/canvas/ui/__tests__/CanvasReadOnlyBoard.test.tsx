/**
 * entities/canvas/ui/CanvasReadOnlyBoard.test.tsx
 *
 * read-only 임베드 보드 — 편집 차단 prop 배선 + nodes/edges 변환 검증.
 * ReactFlow 는 mock 하여 전달된 props 를 캡처한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const flowProps = vi.hoisted(
  () => ({ current: null as null | Record<string, unknown> })
)

const queryMocks = vi.hoisted(() => ({
  nodes: [] as unknown[],
  edges: [] as unknown[]
}))

vi.mock('@xyflow/react', () => ({
  ReactFlow: (props: Record<string, unknown>) => {
    flowProps.current = props
    return <div data-testid="rf">{props.children as React.ReactNode}</div>
  },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Background: () => <div data-testid="bg" />,
  Controls: () => <div data-testid="controls" />,
  BackgroundVariant: { Dots: 'dots' }
}))

vi.mock('../../api/queries', () => ({
  useCanvasNodes: () => ({ data: queryMocks.nodes }),
  useCanvasEdges: () => ({ data: queryMocks.edges })
}))

import { CanvasReadOnlyBoard } from '../CanvasReadOnlyBoard'

function textNodeItem(id: string): Record<string, unknown> {
  return {
    id,
    canvasId: 'cv1',
    type: 'text',
    refId: null,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    color: null,
    content: 'hello',
    zIndex: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  }
}

function refNodeItem(id: string): Record<string, unknown> {
  return {
    ...textNodeItem(id),
    type: 'note',
    refId: 'note-1',
    content: null,
    refTitle: 'My Note'
  }
}

function edgeItem(id: string): Record<string, unknown> {
  return {
    id,
    canvasId: 'cv1',
    fromNode: 'a',
    toNode: 'b',
    fromSide: 'right',
    toSide: 'left',
    label: 'rel',
    color: null,
    style: 'solid',
    arrow: 'end',
    createdAt: new Date(0)
  }
}

beforeEach(() => {
  flowProps.current = null
  queryMocks.nodes = []
  queryMocks.edges = []
})

describe('CanvasReadOnlyBoard', () => {
  it('편집 차단 prop 이 모두 false + pan/zoom 허용 + fitView', () => {
    render(<CanvasReadOnlyBoard canvasId="cv1" />)
    const p = flowProps.current!
    expect(p.nodesDraggable).toBe(false)
    expect(p.nodesConnectable).toBe(false)
    expect(p.elementsSelectable).toBe(false)
    expect(p.edgesFocusable).toBe(false)
    expect(p.nodesFocusable).toBe(false)
    expect(p.panOnDrag).toBe(true)
    expect(p.zoomOnScroll).toBe(true)
    expect(p.fitView).toBe(true)
  })

  it('node items → ReactFlow nodes 변환 (text/ref)', () => {
    queryMocks.nodes = [textNodeItem('n1'), refNodeItem('n2')]
    render(<CanvasReadOnlyBoard canvasId="cv1" />)
    const nodes = flowProps.current!.nodes as Array<{ id: string; type: string }>
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({ id: 'n1', type: 'textNode' })
    expect(nodes[1]).toMatchObject({ id: 'n2', type: 'refNode' })
  })

  it('edge 는 기본 엣지로 렌더 (type undefined) + label/marker 유지', () => {
    queryMocks.edges = [edgeItem('e1')]
    render(<CanvasReadOnlyBoard canvasId="cv1" />)
    const edges = flowProps.current!.edges as Array<{ id: string; type?: string; label?: string }>
    expect(edges).toHaveLength(1)
    expect(edges[0].id).toBe('e1')
    expect(edges[0].type).toBeUndefined()
    expect(edges[0].label).toBe('rel')
  })

  it('빈 캔버스 → nodes/edges 빈 배열', () => {
    render(<CanvasReadOnlyBoard canvasId="cv1" />)
    expect(flowProps.current!.nodes).toEqual([])
    expect(flowProps.current!.edges).toEqual([])
  })
})
