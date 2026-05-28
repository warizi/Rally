import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useCanvasesByWorkspace,
  useCanvasById,
  useCanvasNodes,
  useCanvasEdges,
  useCreateCanvas,
  useUpdateCanvas,
  useUpdateCanvasViewport,
  useRemoveCanvas,
  useCreateCanvasNode,
  useUpdateCanvasNode,
  useUpdateCanvasNodePositions,
  useRemoveCanvasNode,
  useCreateCanvasEdge,
  useUpdateCanvasEdge,
  useRemoveCanvasEdge
} from '../queries'

const mockFindByWorkspace = vi.fn()
const mockFindById = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockUpdateViewport = vi.fn()
const mockRemove = vi.fn()

const mockNodeFindByCanvas = vi.fn()
const mockNodeCreate = vi.fn()
const mockNodeUpdate = vi.fn()
const mockNodeUpdatePositions = vi.fn()
const mockNodeRemove = vi.fn()

const mockEdgeFindByCanvas = vi.fn()
const mockEdgeCreate = vi.fn()
const mockEdgeUpdate = vi.fn()
const mockEdgeRemove = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    canvas: {
      findByWorkspace: mockFindByWorkspace,
      findById: mockFindById,
      create: mockCreate,
      update: mockUpdate,
      updateViewport: mockUpdateViewport,
      remove: mockRemove
    },
    canvasNode: {
      findByCanvas: mockNodeFindByCanvas,
      create: mockNodeCreate,
      update: mockNodeUpdate,
      updatePositions: mockNodeUpdatePositions,
      remove: mockNodeRemove
    },
    canvasEdge: {
      findByCanvas: mockEdgeFindByCanvas,
      create: mockEdgeCreate,
      update: mockEdgeUpdate,
      remove: mockEdgeRemove
    }
  }
  vi.clearAllMocks()
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const MOCK_CANVAS = { id: 'c-1', title: 'Test', workspaceId: 'ws-1' }
const MOCK_NODE = { id: 'n-1', canvasId: 'c-1', type: 'text' }
const MOCK_EDGE = { id: 'e-1', canvasId: 'c-1', fromNode: 'n-1', toNode: 'n-2' }

// ─── Canvas Queries ──────────────────────────────────────

describe('useCanvasesByWorkspace', () => {
  it('성공 → data 배열 반환', async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: [MOCK_CANVAS] })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('success:false → isError=true', async () => {
    mockFindByWorkspace.mockResolvedValue({ success: false, message: '오류' })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it("workspaceId='' → queryFn 미호출 (enabled=false)", () => {
    const { wrapper } = createWrapper()
    renderHook(() => useCanvasesByWorkspace(''), { wrapper })
    expect(mockFindByWorkspace).not.toHaveBeenCalled()
  })

  it('res.data=null → [] 반환', async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: null })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useCanvasById', () => {
  it('성공 → CanvasItem 반환', async () => {
    mockFindById.mockResolvedValue({ success: true, data: MOCK_CANVAS })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasById('c-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(MOCK_CANVAS)
  })

  it('success:false → isError=true', async () => {
    mockFindById.mockResolvedValue({ success: false, message: '오류' })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasById('c-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('canvasId=undefined → enabled=false', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useCanvasById(undefined), { wrapper })
    expect(mockFindById).not.toHaveBeenCalled()
  })
})

// ─── Canvas Node Queries ─────────────────────────────────

describe('useCanvasNodes', () => {
  it('성공 → CanvasNodeItem[] 반환', async () => {
    mockNodeFindByCanvas.mockResolvedValue({ success: true, data: [MOCK_NODE] })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasNodes('c-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('success:false → isError=true', async () => {
    mockNodeFindByCanvas.mockResolvedValue({ success: false, message: '오류' })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasNodes('c-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('canvasId=undefined → enabled=false', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useCanvasNodes(undefined), { wrapper })
    expect(mockNodeFindByCanvas).not.toHaveBeenCalled()
  })

  it('res.data=null → [] 반환', async () => {
    mockNodeFindByCanvas.mockResolvedValue({ success: true, data: null })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasNodes('c-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ─── Canvas Edge Queries ─────────────────────────────────

describe('useCanvasEdges', () => {
  it('성공 → CanvasEdgeItem[] 반환', async () => {
    mockEdgeFindByCanvas.mockResolvedValue({ success: true, data: [MOCK_EDGE] })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasEdges('c-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('success:false → isError=true', async () => {
    mockEdgeFindByCanvas.mockResolvedValue({ success: false, message: '오류' })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasEdges('c-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('canvasId=undefined → enabled=false', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useCanvasEdges(undefined), { wrapper })
    expect(mockEdgeFindByCanvas).not.toHaveBeenCalled()
  })

  it('res.data=null → [] 반환', async () => {
    mockEdgeFindByCanvas.mockResolvedValue({ success: true, data: null })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCanvasEdges('c-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ─── Canvas Mutations ────────────────────────────────────

describe('useCreateCanvas', () => {
  it('canvas.create(workspaceId, data) 호출', async () => {
    mockCreate.mockResolvedValue({ success: true, data: MOCK_CANVAS })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateCanvas(), { wrapper })
    result.current.mutate({ workspaceId: 'ws-1', data: { title: '새 캔버스' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockCreate).toHaveBeenCalledWith('ws-1', { title: '새 캔버스' })
  })
})

describe('useUpdateCanvas', () => {
  it('canvas.update(canvasId, data) 호출 + setQueryData', async () => {
    const updated = { ...MOCK_CANVAS, title: '수정됨' }
    mockUpdate.mockResolvedValue({ success: true, data: updated })
    const { queryClient, wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateCanvas(), { wrapper })
    result.current.mutate({
      canvasId: 'c-1',
      data: { title: '수정됨' },
      workspaceId: 'ws-1'
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockUpdate).toHaveBeenCalledWith('c-1', { title: '수정됨' })
    // setQueryData로 detail 캐시가 업데이트됨
    const cached = queryClient.getQueryData(['canvas', 'detail', 'c-1'])
    expect(cached).toEqual(updated)
  })
})

describe('useUpdateCanvasViewport', () => {
  it('canvas.updateViewport(canvasId, viewport) 호출 — fire-and-forget', async () => {
    mockUpdateViewport.mockResolvedValue({ success: true })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateCanvasViewport(), { wrapper })
    result.current.mutate({ canvasId: 'c-1', viewport: { x: 100, y: 200, zoom: 1.5 } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockUpdateViewport).toHaveBeenCalledWith('c-1', { x: 100, y: 200, zoom: 1.5 })
  })
})

describe('useRemoveCanvas', () => {
  it('canvas.remove(canvasId) 호출', async () => {
    mockRemove.mockResolvedValue({ success: true })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useRemoveCanvas(), { wrapper })
    result.current.mutate({ canvasId: 'c-1', workspaceId: 'ws-1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockRemove).toHaveBeenCalledWith('c-1')
    expect(mockRemove.mock.calls[0]).toHaveLength(1)
  })
})

// ─── Canvas Node Mutations ───────────────────────────────

describe('useCreateCanvasNode', () => {
  it('canvasNode.create(canvasId, data) 호출', async () => {
    mockNodeCreate.mockResolvedValue({ success: true, data: MOCK_NODE })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateCanvasNode(), { wrapper })
    result.current.mutate({
      canvasId: 'c-1',
      data: { type: 'text' as const, x: 0, y: 0 }
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockNodeCreate).toHaveBeenCalledWith('c-1', { type: 'text', x: 0, y: 0 })
  })
})

describe('useUpdateCanvasNode', () => {
  it('canvasNode.update(nodeId, data) 호출', async () => {
    mockNodeUpdate.mockResolvedValue({ success: true, data: MOCK_NODE })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateCanvasNode(), { wrapper })
    result.current.mutate({
      nodeId: 'n-1',
      data: { content: '수정' },
      canvasId: 'c-1'
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockNodeUpdate).toHaveBeenCalledWith('n-1', { content: '수정' })
  })
})

describe('useUpdateCanvasNodePositions', () => {
  it('canvasNode.updatePositions(updates) 호출 — canvasId IPC 미전달', async () => {
    mockNodeUpdatePositions.mockResolvedValue({ success: true })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateCanvasNodePositions(), { wrapper })
    const updates = [{ id: 'n-1', x: 100, y: 200 }]
    result.current.mutate({ updates, canvasId: 'c-1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockNodeUpdatePositions).toHaveBeenCalledWith(updates)
    expect(mockNodeUpdatePositions.mock.calls[0]).toHaveLength(1)
  })
})

describe('useRemoveCanvasNode', () => {
  it('canvasNode.remove(nodeId) 호출', async () => {
    mockNodeRemove.mockResolvedValue({ success: true })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useRemoveCanvasNode(), { wrapper })
    result.current.mutate({ nodeId: 'n-1', canvasId: 'c-1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockNodeRemove).toHaveBeenCalledWith('n-1')
    expect(mockNodeRemove.mock.calls[0]).toHaveLength(1)
  })
})

// ─── Canvas Edge Mutations ───────────────────────────────

describe('useCreateCanvasEdge', () => {
  it('canvasEdge.create(canvasId, data) 호출', async () => {
    mockEdgeCreate.mockResolvedValue({ success: true, data: MOCK_EDGE })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateCanvasEdge(), { wrapper })
    result.current.mutate({
      canvasId: 'c-1',
      data: { fromNode: 'n-1', toNode: 'n-2' }
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockEdgeCreate).toHaveBeenCalledWith('c-1', { fromNode: 'n-1', toNode: 'n-2' })
  })
})

describe('useUpdateCanvasEdge', () => {
  it('canvasEdge.update(edgeId, data) 호출', async () => {
    mockEdgeUpdate.mockResolvedValue({ success: true, data: MOCK_EDGE })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateCanvasEdge(), { wrapper })
    result.current.mutate({
      edgeId: 'e-1',
      data: { style: 'dashed' as const },
      canvasId: 'c-1'
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockEdgeUpdate).toHaveBeenCalledWith('e-1', { style: 'dashed' })
  })
})

describe('useRemoveCanvasEdge', () => {
  it('canvasEdge.remove(edgeId) 호출', async () => {
    mockEdgeRemove.mockResolvedValue({ success: true })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useRemoveCanvasEdge(), { wrapper })
    result.current.mutate({ edgeId: 'e-1', canvasId: 'c-1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockEdgeRemove).toHaveBeenCalledWith('e-1')
    expect(mockEdgeRemove.mock.calls[0]).toHaveLength(1)
  })
})
