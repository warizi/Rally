/**
 * widgets/canvas/ui/NodeColorToolbar.test.tsx
 *
 * 선택 없음 → null. 노드 선택 → 8 색상 + clear 버튼. 색상 클릭 → setNodes + updateNode mutate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeNode {
  id: string
  selected: boolean
  data: { color: string | null; canvasId: string }
}

const mocks = vi.hoisted(() => ({
  nodes: [] as FakeNode[],
  edges: [] as Array<{ selected: boolean }>,
  setNodes: vi.fn(),
  mutate: vi.fn()
}))

vi.mock('@xyflow/react', () => ({
  useStore: (sel: (s: { nodes: FakeNode[]; edges: Array<{ selected: boolean }> }) => unknown) =>
    sel({ nodes: mocks.nodes, edges: mocks.edges })
}))

vi.mock('@entities/canvas', () => ({
  useUpdateCanvasNode: () => ({ mutate: mocks.mutate })
}))

import { NodeColorToolbar } from '../NodeColorToolbar'

const fakeStore = {
  getState: () => ({ nodes: mocks.nodes, setNodes: mocks.setNodes })
} as unknown as Parameters<typeof NodeColorToolbar>[0]['store']

beforeEach(() => {
  mocks.nodes = []
  mocks.edges = []
  mocks.setNodes.mockReset()
  mocks.mutate.mockReset()
})

describe('NodeColorToolbar', () => {
  it('선택 없음 → null', () => {
    const { container } = render(<NodeColorToolbar store={fakeStore} />)
    expect(container.firstChild).toBeNull()
  })

  it('노드 1개 선택 + 엣지 미선택 → 툴바 + 8 색상 노출', () => {
    mocks.nodes = [{ id: 'a', selected: true, data: { color: null, canvasId: 'c1' } }]
    render(<NodeColorToolbar store={fakeStore} />)
    expect(screen.getAllByRole('button')).toHaveLength(8) // color buttons (no clear since color=null)
  })

  it('엣지도 선택 → null', () => {
    mocks.nodes = [{ id: 'a', selected: true, data: { color: null, canvasId: 'c1' } }]
    mocks.edges = [{ selected: true }]
    const { container } = render(<NodeColorToolbar store={fakeStore} />)
    expect(container.firstChild).toBeNull()
  })

  it('색상 클릭 → setNodes + mutate', () => {
    mocks.nodes = [{ id: 'a', selected: true, data: { color: null, canvasId: 'c1' } }]
    render(<NodeColorToolbar store={fakeStore} />)
    const colorBtns = screen.getAllByRole('button')
    fireEvent.click(colorBtns[0])
    expect(mocks.setNodes).toHaveBeenCalled()
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'a', data: { color: '#ef4444' } })
    )
  })

  it('현재 색상 있음 → clear 버튼 9개 노출 + 클릭 → null 전달', () => {
    mocks.nodes = [{ id: 'a', selected: true, data: { color: '#ef4444', canvasId: 'c1' } }]
    render(<NodeColorToolbar store={fakeStore} />)
    const btns = screen.getAllByRole('button')
    expect(btns).toHaveLength(9) // 8 color + 1 clear
    fireEvent.click(btns[8])
    expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ data: { color: '' } }))
  })
})
