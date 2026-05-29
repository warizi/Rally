/**
 * widgets/canvas/ui/CanvasBoard.test.tsx
 *
 * isReady (=!isLoading && hydrated) 분기 → 로딩 / Inner.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  data: {
    isLoading: false,
    hydrated: true,
    nodes: [],
    edges: [],
    defaultViewport: { x: 0, y: 0, zoom: 1 },
    hasSavedViewport: false,
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onConnect: vi.fn(),
    saveViewport: vi.fn(),
    addTextNode: vi.fn(),
    addRefNode: vi.fn(),
    createNodeAsync: vi.fn(),
    createEdgeAsync: vi.fn(),
    store: {},
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false
  } as unknown as ReturnType<typeof import('../../model/use-canvas-data').useCanvasData>
}))

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="react-flow-provider">{children}</div>
  )
}))
vi.mock('../../model/use-canvas-data', () => ({
  useCanvasData: () => mocks.data
}))
vi.mock('../CanvasBoardInner', () => ({
  CanvasBoardInner: () => <div data-testid="canvas-inner" />
}))

import { CanvasBoard } from '../CanvasBoard'

beforeEach(() => {
  mocks.data = {
    ...mocks.data,
    isLoading: false,
    hydrated: true
  }
})

describe('CanvasBoard', () => {
  it('isLoading=true → 로딩 메시지', () => {
    mocks.data = { ...mocks.data, isLoading: true, hydrated: true }
    render(<CanvasBoard canvasId="cv-1" />)
    expect(screen.getByText('캔버스 로딩 중...')).toBeInTheDocument()
  })

  it('hydrated=false → 로딩 메시지', () => {
    mocks.data = { ...mocks.data, isLoading: false, hydrated: false }
    render(<CanvasBoard canvasId="cv-1" />)
    expect(screen.getByText('캔버스 로딩 중...')).toBeInTheDocument()
  })

  it('isReady=true → ReactFlowProvider + CanvasBoardInner', () => {
    render(<CanvasBoard canvasId="cv-1" />)
    expect(screen.getByTestId('react-flow-provider')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-inner')).toBeInTheDocument()
  })
})
