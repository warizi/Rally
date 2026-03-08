import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useFolderTree,
  useCreateFolder,
  useRenameFolder,
  useRemoveFolder,
  useMoveFolder,
  useUpdateFolderMeta
} from '../queries'
import type { FolderNode } from '../../model/types'

// ─── window.api mock ──────────────────────────────────────────
const mockReadTree = vi.fn()
const mockCreate = vi.fn()
const mockRename = vi.fn()
const mockRemove = vi.fn()
const mockMove = vi.fn()
const mockUpdateMeta = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    folder: {
      readTree: mockReadTree,
      create: mockCreate,
      rename: mockRename,
      remove: mockRemove,
      move: mockMove,
      updateMeta: mockUpdateMeta
    }
  }
  vi.clearAllMocks()
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

// ─── 테스트 헬퍼 ─────────────────────────────────────────────
function createWrapper(): {
  queryClient: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const SAMPLE_NODE: FolderNode = {
  id: 'f1',
  name: 'docs',
  relativePath: 'docs',
  color: null,
  order: 0,
  children: []
}

// ─── useFolderTree ───────────────────────────────────────────
describe('useFolderTree', () => {
  it('성공 시 data를 반환한다', async () => {
    mockReadTree.mockResolvedValue({ success: true, data: [SAMPLE_NODE] })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useFolderTree('ws-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([SAMPLE_NODE])
  })

  it('IPC success:false면 error 상태가 된다', async () => {
    mockReadTree.mockResolvedValue({
      success: false,
      errorType: 'NotFoundError',
      message: 'workspace not found'
    })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useFolderTree('ws-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('workspaceId=""이면 queryFn을 호출하지 않는다 (enabled=false)', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useFolderTree(''), { wrapper })

    // 짧게 대기해도 호출되지 않아야 함
    await new Promise((r) => setTimeout(r, 50))
    expect(mockReadTree).not.toHaveBeenCalled()
  })
})

// ─── useCreateFolder ─────────────────────────────────────────
describe('useCreateFolder', () => {
  it('onSuccess 시 folder tree queryKey를 invalidate한다', async () => {
    mockCreate.mockResolvedValue({ success: true, data: SAMPLE_NODE })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateFolder(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', parentFolderId: null, name: 'docs' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folder', 'tree', 'ws-1'] })
  })

  it('IPC success:false면 error 상태가 된다', async () => {
    mockCreate.mockResolvedValue({
      success: false,
      errorType: 'ValidationError',
      message: 'invalid'
    })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateFolder(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', parentFolderId: null, name: 'x' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── useRenameFolder ─────────────────────────────────────────
describe('useRenameFolder', () => {
  it('onSuccess 시 folder tree queryKey를 invalidate한다', async () => {
    mockRename.mockResolvedValue({ success: true, data: { ...SAMPLE_NODE, name: 'renamed' } })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRenameFolder(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', folderId: 'f1', newName: 'renamed' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folder', 'tree', 'ws-1'] })
  })
})

// ─── useRemoveFolder ─────────────────────────────────────────
describe('useRemoveFolder', () => {
  it('onSuccess 시 folder tree queryKey를 invalidate한다', async () => {
    mockRemove.mockResolvedValue({ success: true, data: undefined })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveFolder(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', folderId: 'f1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folder', 'tree', 'ws-1'] })
  })
})

// ─── useMoveFolder ───────────────────────────────────────────
describe('useMoveFolder', () => {
  it('onSuccess 시 folder tree queryKey를 invalidate한다', async () => {
    mockMove.mockResolvedValue({ success: true, data: SAMPLE_NODE })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useMoveFolder(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', folderId: 'f1', parentFolderId: null, index: 0 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folder', 'tree', 'ws-1'] })
  })
})

// ─── useUpdateFolderMeta ─────────────────────────────────────
describe('useUpdateFolderMeta', () => {
  it('onSuccess 시 folder tree queryKey를 invalidate한다', async () => {
    mockUpdateMeta.mockResolvedValue({
      success: true,
      data: { ...SAMPLE_NODE, color: '#ff0000' }
    })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateFolderMeta(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', folderId: 'f1', data: { color: '#ff0000' } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folder', 'tree', 'ws-1'] })
  })
})
