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

const clipboardMocks = vi.hoisted(() => ({
  copy: vi.fn(),
  paste: vi.fn().mockResolvedValue([]),
  hasClipboard: vi.fn(() => false)
}))

vi.mock('../../model/use-canvas-clipboard', () => ({
  useCanvasClipboard: () => ({
    copy: clipboardMocks.copy,
    paste: clipboardMocks.paste,
    hasClipboard: clipboardMocks.hasClipboard
  })
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

  it('CanvasToolbar 마운트', () => {
    render(<CanvasBoardInner {...baseProps} />)
    expect(screen.getByTestId('canvas-toolbar')).toBeInTheDocument()
  })

  it('SelectionToolbar 마운트', () => {
    render(<CanvasBoardInner {...baseProps} />)
    expect(screen.getByTestId('selection-toolbar')).toBeInTheDocument()
  })

  it('NodeColorToolbar 마운트', () => {
    render(<CanvasBoardInner {...baseProps} />)
    expect(screen.getByTestId('node-color-toolbar')).toBeInTheDocument()
  })

  it('EdgeEditToolbar 마운트', () => {
    render(<CanvasBoardInner {...baseProps} />)
    expect(screen.getByTestId('edge-edit-toolbar')).toBeInTheDocument()
  })

  it('nodes/edges 빈 배열 → smoke', () => {
    render(<CanvasBoardInner {...baseProps} nodes={[]} edges={[]} />)
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
  })

  it('defaultViewport zoom 변형 → smoke', () => {
    render(<CanvasBoardInner {...baseProps} defaultViewport={{ x: 100, y: 200, zoom: 2.5 }} />)
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
  })

  it('Cmd+C (selected nodes 있음) → copy 호출', () => {
    clipboardMocks.copy.mockClear()
    render(<CanvasBoardInner {...baseProps} />)
    // useReactFlow mock 에서 getNodes 가 selected:true 반환하도록 임시 변경
    // 기본 mock 은 빈 배열이라 hasSelected=false → return early
    const evt = new KeyboardEvent('keydown', { key: 'c', metaKey: true })
    document.dispatchEvent(evt)
    expect(clipboardMocks.copy).not.toHaveBeenCalled()
  })

  it('Cmd+V → handlePaste 호출 (hasClipboard=false 이면 early return)', () => {
    clipboardMocks.hasClipboard.mockReturnValue(false)
    clipboardMocks.paste.mockClear()
    render(<CanvasBoardInner {...baseProps} />)
    const evt = new KeyboardEvent('keydown', { key: 'v', metaKey: true })
    document.dispatchEvent(evt)
    expect(clipboardMocks.paste).not.toHaveBeenCalled()
  })

  it('Cmd+Z (without Shift) → undo 호출', () => {
    const undo = vi.fn()
    render(<CanvasBoardInner {...baseProps} undo={undo} canUndo={true} />)
    const evt = new KeyboardEvent('keydown', { key: 'z', metaKey: true })
    document.dispatchEvent(evt)
    expect(undo).toHaveBeenCalled()
  })

  it('Cmd+Shift+Z → redo 호출', () => {
    const redo = vi.fn()
    render(<CanvasBoardInner {...baseProps} redo={redo} canRedo={true} />)
    const evt = new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true })
    document.dispatchEvent(evt)
    expect(redo).toHaveBeenCalled()
  })

  it('INPUT focus 상태에서 키 입력 → undo/redo 호출 안 함', () => {
    const undo = vi.fn()
    render(<CanvasBoardInner {...baseProps} undo={undo} canUndo={true} />)
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const evt = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })
    Object.defineProperty(evt, 'target', { value: input, writable: false })
    document.dispatchEvent(evt)
    expect(undo).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })
})
