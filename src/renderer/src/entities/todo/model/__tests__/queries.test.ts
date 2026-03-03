import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useTodosByWorkspace,
  useActiveTodosByWorkspace,
  useCompletedTodosByWorkspace,
  useCreateTodo,
  useUpdateTodo,
  useRemoveTodo,
  useReorderTodoList,
  useReorderTodoKanban,
  useReorderTodoSub
} from '../queries'

const mockFindByWorkspace = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockRemove = vi.fn()
const mockReorderList = vi.fn()
const mockReorderKanban = vi.fn()
const mockReorderSub = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    todo: {
      findByWorkspace: mockFindByWorkspace,
      create: mockCreate,
      update: mockUpdate,
      remove: mockRemove,
      reorderList: mockReorderList,
      reorderKanban: mockReorderKanban,
      reorderSub: mockReorderSub
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

const MOCK_TODO = { id: 't1', title: 'Test', status: '할일' }

describe('useTodosByWorkspace', () => {
  it('성공 → data 배열 반환', async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: [MOCK_TODO] })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('success:false → isError=true', async () => {
    mockFindByWorkspace.mockResolvedValue({ success: false, message: '오류' })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it("workspaceId='' → queryFn 미호출 (enabled=false)", () => {
    const { wrapper } = createWrapper()
    renderHook(() => useTodosByWorkspace(''), { wrapper })
    expect(mockFindByWorkspace).not.toHaveBeenCalled()
  })

  it('workspaceId=null → enabled=false', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useTodosByWorkspace(null), { wrapper })
    expect(mockFindByWorkspace).not.toHaveBeenCalled()
  })

  it('workspaceId=undefined → enabled=false', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useTodosByWorkspace(undefined), { wrapper })
    expect(mockFindByWorkspace).not.toHaveBeenCalled()
  })

  it('res.data=null → [] 반환', async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: null })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it("filter='active' → queryKey에 'active' 포함 (4개 요소)", async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: [] })
    const { queryClient, wrapper } = createWrapper()
    renderHook(() => useActiveTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(mockFindByWorkspace).toHaveBeenCalled())
    const cache = queryClient.getQueryCache().getAll()
    const keys = cache.map((q) => q.queryKey)
    expect(keys).toContainEqual(['todo', 'workspace', 'ws-1', 'active'])
  })
})

describe('useActiveTodosByWorkspace', () => {
  it("IPC에 { filter: 'active' } 전달", async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: [] })
    const { wrapper } = createWrapper()
    renderHook(() => useActiveTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(mockFindByWorkspace).toHaveBeenCalled())
    expect(mockFindByWorkspace).toHaveBeenCalledWith('ws-1', { filter: 'active' })
  })
})

describe('useCompletedTodosByWorkspace', () => {
  it("queryKey에 'completed' 포함", async () => {
    mockFindByWorkspace.mockResolvedValue({ success: true, data: [] })
    const { queryClient, wrapper } = createWrapper()
    renderHook(() => useCompletedTodosByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(mockFindByWorkspace).toHaveBeenCalled())
    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
    expect(keys).toContainEqual(['todo', 'workspace', 'ws-1', 'completed'])
  })
})

describe('useCreateTodo', () => {
  it('create(workspaceId, data) 호출', async () => {
    mockCreate.mockResolvedValue({ success: true, data: MOCK_TODO })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateTodo(), { wrapper })
    result.current.mutate({ workspaceId: 'ws-1', data: { title: '새 투두' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockCreate).toHaveBeenCalledWith('ws-1', { title: '새 투두' })
  })
})

describe('useUpdateTodo', () => {
  it('update(todoId, data) 호출 — workspaceId IPC 미포함', async () => {
    mockUpdate.mockResolvedValue({ success: true, data: MOCK_TODO })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateTodo(), { wrapper })
    result.current.mutate({ workspaceId: 'ws-1', todoId: 'todo-1', data: { title: '수정' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockUpdate).toHaveBeenCalledWith('todo-1', { title: '수정' })
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate.mock.calls[0]).toHaveLength(2)
  })
})

describe('useRemoveTodo', () => {
  it('remove(todoId) 호출 — workspaceId IPC 미포함', async () => {
    mockRemove.mockResolvedValue({ success: true, data: undefined })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useRemoveTodo(), { wrapper })
    result.current.mutate({ workspaceId: 'ws-1', todoId: 'todo-1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockRemove).toHaveBeenCalledWith('todo-1')
    expect(mockRemove.mock.calls[0]).toHaveLength(1)
  })
})

describe('useReorderTodoList', () => {
  it('reorderList(workspaceId, updates) 호출', async () => {
    mockReorderList.mockResolvedValue({ success: true, data: undefined })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReorderTodoList(), { wrapper })
    result.current.mutate({ workspaceId: 'ws-1', updates: [{ id: 'todo-1', order: 0 }] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockReorderList).toHaveBeenCalledWith('ws-1', [{ id: 'todo-1', order: 0 }])
    expect(mockReorderList.mock.calls[0]).toHaveLength(2)
  })
})

describe('useReorderTodoKanban', () => {
  it('reorderKanban(workspaceId, updates) 호출', async () => {
    mockReorderKanban.mockResolvedValue({ success: true, data: undefined })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReorderTodoKanban(), { wrapper })
    result.current.mutate({ workspaceId: 'ws-1', updates: [{ id: 'todo-1', order: 2 }] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockReorderKanban).toHaveBeenCalledWith('ws-1', [{ id: 'todo-1', order: 2 }])
    expect(mockReorderKanban.mock.calls[0]).toHaveLength(2)
  })
})

describe('useReorderTodoSub', () => {
  it('reorderSub(parentId, updates) 호출', async () => {
    mockReorderSub.mockResolvedValue({ success: true, data: undefined })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReorderTodoSub(), { wrapper })
    result.current.mutate({
      workspaceId: 'ws-1',
      parentId: 'par-1',
      updates: [{ id: 'sub-1', order: 0 }]
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockReorderSub).toHaveBeenCalledWith('par-1', [{ id: 'sub-1', order: 0 }])
  })
})
