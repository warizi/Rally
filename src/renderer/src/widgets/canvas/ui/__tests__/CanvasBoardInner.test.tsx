/**
 * widgets/canvas/ui/CanvasBoardInner.test.tsx
 *
 * ReactFlow + 자식 컴포넌트들 (CanvasToolbar, SelectionToolbar 등) 마운트 (smoke).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  BackgroundVariant: { Dots: 'dots' },
  ConnectionMode: { Loose: 'loose' },
  useReactFlow: () => ({
    screenToFlowPosition: vi.fn(() => ({ x: 0, y: 0 })),
    getNodes: () => [],
    getEdges: () => []
  })
}))

vi.mock('../TextNode', () => ({ TextNode: () => null }))
vi.mock('../RefNode', () => ({ RefNode: () => null }))
vi.mock('../CustomEdge', () => ({ CustomEdge: () => null }))

vi.mock('../CanvasToolbar', () => ({
  CanvasToolbar: () => <div data-testid="canvas-toolbar" />
}))

vi.mock('../EntityPickerDialog', () => ({
  EntityPickerDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="entity-picker" /> : null
}))

vi.mock('../SelectionToolbar', () => ({
  SelectionToolbar: () => <div data-testid="selection-toolbar" />
}))

vi.mock('../NodeColorToolbar', () => ({
  NodeColorToolbar: () => <div data-testid="node-color-toolbar" />
}))

vi.mock('../EdgeEditToolbar', () => ({
  EdgeEditToolbar: () => <div data-testid="edge-edit-toolbar" />
}))

vi.mock('../../model/node-type-registry', () => ({
  NODE_TYPE_REGISTRY: {}
}))

vi.mock('../../model/canvas-layout', () => ({
  findNonOverlappingPosition: () => ({ x: 0, y: 0 })
}))

vi.mock('../../model/use-canvas-clipboard', () => ({
  useCanvasClipboard: () => ({ copy: vi.fn(), paste: vi.fn() })
}))

import { CanvasBoardInner } from '../CanvasBoardInner'

const fakeStore = {
  getState: () => ({ nodes: [], edges: [], setNodes: vi.fn(), setEdges: vi.fn() }),
  subscribe: vi.fn(),
  setState: vi.fn(),
  destroy: vi.fn()
} as unknown as Parameters<typeof CanvasBoardInner>[0]['store']

const baseProps = {
  nodes: [],
  edges: [],
  defaultViewport: { x: 0, y: 0, zoom: 1 },
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
  onConnect: vi.fn(),
  saveViewport: vi.fn(),
  addTextNode: vi.fn(),
  addRefNode: vi.fn(),
  canvasId: 'c1',
  createNodeAsync: vi.fn(),
  createEdgeAsync: vi.fn(),
  store: fakeStore,
  hasSavedViewport: true,
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: false,
  canRedo: false
} as unknown as Parameters<typeof CanvasBoardInner>[0]

describe('CanvasBoardInner', () => {
  it('ReactFlow + Toolbar 컴포넌트 마운트', () => {
    render(<CanvasBoardInner {...baseProps} />)
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('selection-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('node-color-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('edge-edit-toolbar')).toBeInTheDocument()
  })

  it('Background / Controls 마운트', () => {
    render(<CanvasBoardInner {...baseProps} />)
    expect(screen.getByTestId('background')).toBeInTheDocument()
    expect(screen.getByTestId('controls')).toBeInTheDocument()
  })

  it('EntityPickerDialog 초기 closed', () => {
    render(<CanvasBoardInner {...baseProps} />)
    expect(screen.queryByTestId('entity-picker')).not.toBeInTheDocument()
  })

  it('MiniMap 마운트 (초기 showMinimap=true)', () => {
    render(<CanvasBoardInner {...baseProps} />)
    expect(screen.getByTestId('minimap')).toBeInTheDocument()
  })

  it('hasSavedViewport=false → 동일 마운트 (defaultViewport prop 무시)', () => {
    render(<CanvasBoardInner {...baseProps} hasSavedViewport={false} />)
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
  })

  it('canUndo=true / canRedo=true → undo/redo 버튼 활성 (smoke)', () => {
    render(<CanvasBoardInner {...baseProps} canUndo={true} canRedo={true} />)
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
  })
})
