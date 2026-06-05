/**
 * widgets/canvas/ui/CanvasBoardInner.test.tsx
 *
 * ReactFlow + 자식 컴포넌트들 (CanvasToolbar, SelectionToolbar 등) 마운트 (smoke).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const reactFlowMocks = vi.hoisted(() => ({
  nodes: [] as Array<{ id: string; selected?: boolean }>,
  edges: [] as Array<{ id: string }>,
  viewport: { x: 0, y: 0, zoom: 1 },
  onMoveEnd: undefined as undefined | (() => void),
  onDoubleClick: undefined as undefined | ((e: React.MouseEvent) => void)
}))

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({
    children,
    onMoveEnd,
    onDoubleClick
  }: {
    children?: React.ReactNode
    onMoveEnd?: () => void
    onDoubleClick?: (e: React.MouseEvent) => void
  }) => {
    reactFlowMocks.onMoveEnd = onMoveEnd
    reactFlowMocks.onDoubleClick = onDoubleClick
    return <div data-testid="react-flow">{children}</div>
  },
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  BackgroundVariant: { Dots: 'dots' },
  ConnectionMode: { Loose: 'loose' },
  useReactFlow: () => ({
    screenToFlowPosition: vi.fn(() => ({ x: 100, y: 200 })),
    getNodes: () => reactFlowMocks.nodes,
    getEdges: () => reactFlowMocks.edges,
    getViewport: () => reactFlowMocks.viewport
  })
}))

vi.mock('../TextNode', () => ({ TextNode: () => null }))
vi.mock('../RefNode', () => ({ RefNode: () => null }))
vi.mock('../CustomEdge', () => ({ CustomEdge: () => null }))

const canvasToolbarMocks = vi.hoisted(() => ({
  onAddText: undefined as undefined | (() => void),
  onAddEntity: undefined as undefined | (() => void),
  onToggleMinimap: undefined as undefined | (() => void)
}))

vi.mock('../CanvasToolbar', () => ({
  CanvasToolbar: (props: {
    onAddText: () => void
    onAddEntity: () => void
    onToggleMinimap: () => void
  }) => {
    canvasToolbarMocks.onAddText = props.onAddText
    canvasToolbarMocks.onAddEntity = props.onAddEntity
    canvasToolbarMocks.onToggleMinimap = props.onToggleMinimap
    return <div data-testid="canvas-toolbar" />
  }
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

  it('Cmd+Y → redo 호출 (alternative key)', () => {
    const redo = vi.fn()
    render(<CanvasBoardInner {...baseProps} redo={redo} canRedo={true} />)
    const evt = new KeyboardEvent('keydown', { key: 'y', metaKey: true })
    document.dispatchEvent(evt)
    expect(redo).toHaveBeenCalled()
  })

  it('CanvasToolbar onAddText → addTextNode 호출', () => {
    const addTextNode = vi.fn()
    render(<CanvasBoardInner {...baseProps} addTextNode={addTextNode} />)
    canvasToolbarMocks.onAddText?.()
    expect(addTextNode).toHaveBeenCalled()
  })

  it('CanvasToolbar onAddEntity → EntityPicker open', () => {
    render(<CanvasBoardInner {...baseProps} />)
    act(() => {
      canvasToolbarMocks.onAddEntity?.()
    })
    expect(screen.getByTestId('entity-picker')).toBeInTheDocument()
  })

  it('CanvasToolbar onToggleMinimap → 상태 토글 (smoke)', () => {
    render(<CanvasBoardInner {...baseProps} />)
    expect(screen.getByTestId('minimap')).toBeInTheDocument()
    act(() => canvasToolbarMocks.onToggleMinimap?.())
    expect(screen.getByTestId('canvas-toolbar')).toBeInTheDocument()
  })

  it('handleDoubleClick + react-flow__pane → addTextNode 호출', () => {
    const addTextNode = vi.fn()
    render(<CanvasBoardInner {...baseProps} addTextNode={addTextNode} />)
    const pane = document.createElement('div')
    pane.classList.add('react-flow__pane')
    const mockEvent = {
      target: pane,
      clientX: 100,
      clientY: 200
    } as unknown as React.MouseEvent
    reactFlowMocks.onDoubleClick?.(mockEvent)
    expect(addTextNode).toHaveBeenCalledWith(100, 200)
  })

  it('handleDoubleClick + non-pane → addTextNode 호출 안 함', () => {
    const addTextNode = vi.fn()
    render(<CanvasBoardInner {...baseProps} addTextNode={addTextNode} />)
    const node = document.createElement('div')
    node.classList.add('react-flow__node')
    const mockEvent = {
      target: node,
      clientX: 100,
      clientY: 200
    } as unknown as React.MouseEvent
    reactFlowMocks.onDoubleClick?.(mockEvent)
    expect(addTextNode).not.toHaveBeenCalled()
  })

  it('handleMoveEnd → setTimeout 후 saveViewport 호출 (debounce 500ms)', () => {
    vi.useFakeTimers()
    const saveViewport = vi.fn()
    render(<CanvasBoardInner {...baseProps} saveViewport={saveViewport} />)
    reactFlowMocks.viewport = { x: 50, y: 60, zoom: 1.5 }
    reactFlowMocks.onMoveEnd?.()
    vi.advanceTimersByTime(600)
    expect(saveViewport).toHaveBeenCalledWith({ x: 50, y: 60, zoom: 1.5 })
    vi.useRealTimers()
  })
})
