/**
 * widgets/canvas/ui/SelectionToolbar.test.tsx
 *
 * useReactFlow + useStore 분기 → 선택 노드/엣지 카운트에 따른 노출/비노출.
 * 삭제 클릭 → deleteElements(선택 노드+엣지).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface Node {
  id: string
  selected: boolean
}
interface Edge {
  id: string
  selected: boolean
}

const mocks = vi.hoisted(() => ({
  nodes: [] as Node[],
  edges: [] as Edge[],
  deleteElements: vi.fn(),
  selector: null as null | ((s: { nodes: Node[]; edges: Edge[] }) => unknown)
}))

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    deleteElements: mocks.deleteElements,
    getNodes: () => mocks.nodes,
    getEdges: () => mocks.edges
  }),
  useStore: (selector: (s: { nodes: Node[]; edges: Edge[] }) => unknown) =>
    selector({ nodes: mocks.nodes, edges: mocks.edges })
}))

import { SelectionToolbar } from '../SelectionToolbar'

beforeEach(() => {
  mocks.nodes = []
  mocks.edges = []
  mocks.deleteElements.mockReset()
})

describe('SelectionToolbar', () => {
  it('totalSelected=0 → null 반환 (미렌더)', () => {
    const { container } = render(<SelectionToolbar onCopy={vi.fn()} onGroupSelection={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('선택 1개 → "1개 선택됨" 노출', () => {
    mocks.nodes = [{ id: 'a', selected: true }]
    render(<SelectionToolbar onCopy={vi.fn()} onGroupSelection={vi.fn()} />)
    expect(screen.getByText('1개 선택됨')).toBeInTheDocument()
  })

  it('선택 노드 있음 → 복사 버튼 노출 + onCopy 호출', () => {
    mocks.nodes = [{ id: 'a', selected: true }]
    const onCopy = vi.fn()
    render(<SelectionToolbar onCopy={onCopy} onGroupSelection={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /복사/ }))
    expect(onCopy).toHaveBeenCalled()
  })

  it('엣지만 선택 → 복사 버튼 미노출, 삭제만 노출', () => {
    mocks.edges = [{ id: 'e1', selected: true }]
    render(<SelectionToolbar onCopy={vi.fn()} onGroupSelection={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /복사/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /삭제/ })).toBeInTheDocument()
  })

  it('삭제 클릭 → deleteElements(선택 노드/엣지)', () => {
    mocks.nodes = [
      { id: 'a', selected: true },
      { id: 'b', selected: false }
    ]
    mocks.edges = [{ id: 'e1', selected: true }]
    render(<SelectionToolbar onCopy={vi.fn()} onGroupSelection={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /삭제/ }))
    expect(mocks.deleteElements).toHaveBeenCalledWith({
      nodes: [{ id: 'a', selected: true }],
      edges: [{ id: 'e1', selected: true }]
    })
  })
})
