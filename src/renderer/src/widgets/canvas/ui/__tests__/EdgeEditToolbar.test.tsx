/**
 * widgets/canvas/ui/EdgeEditToolbar.test.tsx
 *
 * 선택 안 됨 → null. 노드도 선택 → null. 엣지 1개 선택 → 툴바 노출.
 * style/arrow/color/label 버튼 + 삭제 클릭 → deleteElements.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeEdge {
  id: string
  selected: boolean
  label?: string | null
  data: {
    edgeStyle: string
    arrow: string
    color: string | null
    fromSide?: string
    toSide?: string
  }
}

const mocks = vi.hoisted(() => ({
  edges: [] as FakeEdge[],
  nodes: [] as Array<{ selected: boolean }>,
  setEdges: vi.fn(),
  deleteElements: vi.fn(),
  updateMutate: vi.fn(),
  pushHistory: vi.fn()
}))

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ deleteElements: mocks.deleteElements }),
  useStore: (sel: (s: { edges: FakeEdge[]; nodes: Array<{ selected: boolean }> }) => unknown) =>
    sel({ edges: mocks.edges, nodes: mocks.nodes })
}))

vi.mock('@entities/canvas', () => ({
  useUpdateCanvasEdge: () => ({ mutate: mocks.updateMutate }),
  toReactFlowEdge: (edge: { id: string }) => ({ ...edge, source: '', target: '' })
}))

import { EdgeEditToolbar } from '../EdgeEditToolbar'

const fakeStore = {
  getState: () => ({ edges: mocks.edges, setEdges: mocks.setEdges })
} as unknown as Parameters<typeof EdgeEditToolbar>[0]['store']

beforeEach(() => {
  mocks.edges = []
  mocks.nodes = []
  mocks.setEdges.mockReset()
  mocks.deleteElements.mockReset()
  mocks.updateMutate.mockReset()
  mocks.pushHistory.mockReset()
})

describe('EdgeEditToolbar', () => {
  it('엣지 선택 없음 → null', () => {
    const { container } = render(
      <EdgeEditToolbar canvasId="c1" store={fakeStore} pushHistory={mocks.pushHistory} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('엣지 + 노드 동시 선택 → null', () => {
    mocks.edges = [
      {
        id: 'e1',
        selected: true,
        data: { edgeStyle: 'solid', arrow: 'end', color: null }
      }
    ]
    mocks.nodes = [{ selected: true }]
    const { container } = render(
      <EdgeEditToolbar canvasId="c1" store={fakeStore} pushHistory={mocks.pushHistory} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('엣지 1개만 선택 → 툴바 + style/arrow 버튼 노출', () => {
    mocks.edges = [
      {
        id: 'e1',
        selected: true,
        data: { edgeStyle: 'solid', arrow: 'end', color: null }
      }
    ]
    render(<EdgeEditToolbar canvasId="c1" store={fakeStore} pushHistory={mocks.pushHistory} />)
    expect(screen.getByTitle('실선')).toBeInTheDocument()
    expect(screen.getByTitle('점선')).toBeInTheDocument()
    expect(screen.getByTitle('단방향')).toBeInTheDocument()
    expect(screen.getByTitle('양방향')).toBeInTheDocument()
    expect(screen.getByTitle('화살표 없음')).toBeInTheDocument()
  })

  it('스타일 버튼 클릭 → updateEdge.mutate', () => {
    mocks.edges = [
      {
        id: 'e1',
        selected: true,
        data: { edgeStyle: 'solid', arrow: 'end', color: null }
      }
    ]
    render(<EdgeEditToolbar canvasId="c1" store={fakeStore} pushHistory={mocks.pushHistory} />)
    fireEvent.click(screen.getByTitle('점선'))
    expect(mocks.updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ edgeId: 'e1', data: { style: 'dashed' } })
    )
    // 속성 변경이 undo/redo 되도록 history 캡처
    expect(mocks.pushHistory).toHaveBeenCalled()
  })

  it('arrow 버튼 클릭 → updateEdge.mutate', () => {
    mocks.edges = [
      {
        id: 'e1',
        selected: true,
        data: { edgeStyle: 'solid', arrow: 'end', color: null }
      }
    ]
    render(<EdgeEditToolbar canvasId="c1" store={fakeStore} pushHistory={mocks.pushHistory} />)
    fireEvent.click(screen.getByTitle('양방향'))
    expect(mocks.updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ edgeId: 'e1', data: { arrow: 'both' } })
    )
  })

  it('삭제 버튼 클릭 → deleteElements({edges:[{id}]})', () => {
    mocks.edges = [
      {
        id: 'e1',
        selected: true,
        data: { edgeStyle: 'solid', arrow: 'end', color: null }
      }
    ]
    render(<EdgeEditToolbar canvasId="c1" store={fakeStore} pushHistory={mocks.pushHistory} />)
    fireEvent.click(screen.getByTitle('삭제'))
    expect(mocks.deleteElements).toHaveBeenCalledWith({ edges: [{ id: 'e1' }] })
  })

  it('Label toggle → input 노출 (Type icon 클릭)', () => {
    mocks.edges = [
      {
        id: 'e1',
        selected: true,
        data: { edgeStyle: 'solid', arrow: 'end', color: null }
      }
    ]
    render(<EdgeEditToolbar canvasId="c1" store={fakeStore} pushHistory={mocks.pushHistory} />)
    fireEvent.click(screen.getByTitle('텍스트 편집'))
    // label input 이 별도 영역에 노출됨 - 그냥 toggle 동작만 확인
  })

  it('Color toggle 버튼 노출 + 클릭', () => {
    mocks.edges = [
      {
        id: 'e1',
        selected: true,
        data: { edgeStyle: 'solid', arrow: 'end', color: '#ff0000' }
      }
    ]
    render(<EdgeEditToolbar canvasId="c1" store={fakeStore} pushHistory={mocks.pushHistory} />)
    fireEvent.click(screen.getByTitle('색상 변경'))
    // color picker 가 노출됨 - smoke
  })
})
