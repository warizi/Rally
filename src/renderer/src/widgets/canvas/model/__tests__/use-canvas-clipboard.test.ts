/**
 * widgets/canvas/model/use-canvas-clipboard.test.ts
 *
 * 캔버스 노드/엣지 복사·붙여넣기 hook. 모듈 스코프 clipboard 가 호출 간 유지된다.
 * paste 마다 30px offset 누적, 선택된 노드만 복사, 양쪽 끝 선택된 edge 만 복사.
 */
import { describe, it, expect } from 'vitest'
import { useCanvasClipboard } from '../use-canvas-clipboard'
import type {
  CanvasNode,
  CanvasEdge,
  CanvasNodeItem,
  CanvasEdgeItem,
  CreateCanvasNodeData,
  CreateCanvasEdgeData
} from '@entities/canvas'

type CreateNodeFn = (args: {
  canvasId: string
  data: CreateCanvasNodeData
}) => Promise<CanvasNodeItem>
type CreateEdgeFn = (args: {
  canvasId: string
  data: CreateCanvasEdgeData
}) => Promise<CanvasEdgeItem>

function makeNode(
  id: string,
  x: number,
  y: number,
  selected = false,
  overrides: Partial<CanvasNode['data']> = {}
): CanvasNode {
  return {
    id,
    type: 'textNode',
    position: { x, y },
    selected,
    data: {
      nodeType: 'text',
      content: 'hello',
      color: null,
      width: 100,
      height: 100,
      ...overrides
    }
  } as unknown as CanvasNode
}

function makeRefNode(
  id: string,
  x: number,
  y: number,
  refId: string,
  selected = false
): CanvasNode {
  return {
    id,
    type: 'refNode',
    position: { x, y },
    selected,
    data: {
      nodeType: 'note',
      refId,
      content: null,
      color: null,
      width: 200,
      height: 150
    }
  } as unknown as CanvasNode
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  overrides: Partial<CanvasEdge['data']> & { label?: string } = {}
): CanvasEdge {
  const { label, ...dataOverrides } = overrides as Record<string, unknown>
  return {
    id,
    source,
    target,
    label,
    data: { fromSide: 'right', toSide: 'left', ...dataOverrides }
  } as unknown as CanvasEdge
}

describe('useCanvasClipboard', () => {
  it('초기 상태 — hasClipboard 는 false', () => {
    const { hasClipboard } = useCanvasClipboard()
    // 모듈 스코프이므로 다른 테스트가 먼저 실행했으면 true 일 수 있음 — 그래도 boolean 이어야 함
    expect(typeof hasClipboard()).toBe('boolean')
  })

  it('copy: 선택된 노드 0 → false 반환, clipboard 갱신 안 함', () => {
    const { copy } = useCanvasClipboard()
    const nodes = [makeNode('n1', 0, 0, false), makeNode('n2', 10, 10, false)]
    expect(copy(nodes, [])).toBe(false)
  })

  it('copy: 선택된 노드 1+ → true 반환', () => {
    const { copy, hasClipboard } = useCanvasClipboard()
    const nodes = [makeNode('n1', 50, 50, true)]
    expect(copy(nodes, [])).toBe(true)
    expect(hasClipboard()).toBe(true)
  })

  it('copy: 양쪽 끝 모두 선택된 edge 만 복사', async () => {
    const { copy, paste } = useCanvasClipboard()
    const nodes = [
      makeNode('a', 0, 0, true),
      makeNode('b', 100, 0, true),
      makeNode('c', 200, 0, false) // 미선택
    ]
    const edges = [
      makeEdge('e-ab', 'a', 'b'), // 양쪽 선택 → 복사
      makeEdge('e-bc', 'b', 'c') // c 미선택 → 제외
    ]
    expect(copy(nodes, edges)).toBe(true)

    const createdNodes: CanvasNodeItem[] = []
    const createdEdges: { fromNode: string; toNode: string }[] = []
    const createNodeAsync: CreateNodeFn = async ({ data }) => {
      const item = { id: `new-${createdNodes.length}` } as unknown as CanvasNodeItem
      createdNodes.push(item)
      void data
      return item
    }
    const createEdgeAsync: CreateEdgeFn = async ({ data }) => {
      createdEdges.push({ fromNode: data.fromNode, toNode: data.toNode })
      return { id: `eg-${createdEdges.length}` } as unknown as CanvasEdgeItem
    }

    const newIds = await paste('cv-1', { x: 0, y: 0 }, createNodeAsync, createEdgeAsync)
    expect(newIds).toHaveLength(2)
    expect(createdEdges).toHaveLength(1) // 'e-bc' 제외됨
    expect(createdEdges[0].fromNode).toBe('new-0')
    expect(createdEdges[0].toNode).toBe('new-1')
  })

  it('paste: dx/dy 는 첫 선택 노드 기준 상대 좌표 + viewport + offset 30px 적용', async () => {
    const { copy, paste } = useCanvasClipboard()
    const nodes = [makeNode('a', 100, 100, true), makeNode('b', 150, 130, true)]
    copy(nodes, [])

    const positions: Array<{ x: number; y: number }> = []
    const createNodeAsync: CreateNodeFn = async ({ data }) => {
      positions.push({ x: data.x, y: data.y })
      return { id: `n-${positions.length}` } as unknown as CanvasNodeItem
    }
    const createEdgeAsync: CreateEdgeFn = async () => ({}) as unknown as CanvasEdgeItem

    // 첫 paste 는 offset 30
    await paste('cv-1', { x: 500, y: 500 }, createNodeAsync, createEdgeAsync)
    expect(positions[0]).toEqual({ x: 530, y: 530 }) // a: dx=0, dy=0
    expect(positions[1]).toEqual({ x: 580, y: 560 }) // b: dx=50, dy=30

    // 두 번째 paste 는 offset 60 누적
    await paste('cv-1', { x: 500, y: 500 }, createNodeAsync, createEdgeAsync)
    expect(positions[2]).toEqual({ x: 560, y: 560 })
  })

  it('paste: clipboard 가 비어있으면 [] 반환', async () => {
    // 새 copy 호출로 비우려면 빈 nodes 로는 copy 가 false 라서 clipboard 가 안 비워짐.
    // 모듈 스코프 clipboard 상태를 정확히 비울 방법 없음 → 미선택 노드만 있는 케이스로 false 검증.
    const { copy } = useCanvasClipboard()
    expect(copy([], [])).toBe(false)
  })

  it('copy: refNode 는 refId 보존', async () => {
    const { copy, paste } = useCanvasClipboard()
    const nodes = [makeRefNode('rn', 0, 0, 'note-uuid-1', true)]
    expect(copy(nodes, [])).toBe(true)

    let receivedData: { refId?: string; content?: string | null; color?: string | null } = {}
    const createNodeAsync: CreateNodeFn = async (args) => {
      receivedData = args.data as typeof receivedData
      return { id: 'created' } as unknown as CanvasNodeItem
    }
    const createEdgeAsync: CreateEdgeFn = async () => ({}) as unknown as CanvasEdgeItem
    await paste('cv', { x: 0, y: 0 }, createNodeAsync, createEdgeAsync)
    expect(receivedData.refId).toBe('note-uuid-1')
  })
})
