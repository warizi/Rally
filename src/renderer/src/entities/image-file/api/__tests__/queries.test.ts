import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useImageFilesByWorkspace,
  useImportImageFile,
  useRenameImageFile,
  useRemoveImageFile,
  useReadImageContent,
  useMoveImageFile,
  useUpdateImageMeta
} from '../queries'
import type { ImageFileNode } from '../../model/types'

// ─── window.api mock ──────────────────────────────────────────
const mockReadByWorkspace = vi.fn()
const mockImport = vi.fn()
const mockRename = vi.fn()
const mockRemove = vi.fn()
const mockReadContent = vi.fn()
const mockMove = vi.fn()
const mockUpdateMeta = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    image: {
      readByWorkspace: mockReadByWorkspace,
      import: mockImport,
      rename: mockRename,
      remove: mockRemove,
      readContent: mockReadContent,
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

const SAMPLE_IMAGE: ImageFileNode = {
  id: 'img-1',
  title: 'photo',
  relativePath: 'photo.png',
  description: '',
  preview: '',
  folderId: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date()
}

// ─── useImageFilesByWorkspace ──────────────────────────────────
describe('useImageFilesByWorkspace', () => {
  it('성공 시 data를 반환한다', async () => {
    mockReadByWorkspace.mockResolvedValue({ success: true, data: [SAMPLE_IMAGE] })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImageFilesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].id).toBe('img-1')
  })

  it('IPC success:false면 error 상태가 된다', async () => {
    mockReadByWorkspace.mockResolvedValue({
      success: false,
      errorType: 'NotFoundError',
      message: 'workspace not found'
    })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImageFilesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('workspaceId=""이면 queryFn을 호출하지 않는다 (enabled=false)', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useImageFilesByWorkspace(''), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(mockReadByWorkspace).not.toHaveBeenCalled()
  })
})

// ─── useImportImageFile ───────────────────────────────────────
describe('useImportImageFile', () => {
  it('성공 시 ["image", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockImport.mockResolvedValue({ success: true, data: SAMPLE_IMAGE })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useImportImageFile(), { wrapper })
    act(() => {
      result.current.mutate({
        workspaceId: 'ws-1',
        folderId: null,
        sourcePath: '/source/photo.png'
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['image', 'workspace', 'ws-1'] })
  })
})

// ─── useRenameImageFile ───────────────────────────────────────
describe('useRenameImageFile', () => {
  it('성공 시 ["image", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockRename.mockResolvedValue({ success: true, data: { ...SAMPLE_IMAGE, title: 'renamed' } })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRenameImageFile(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', imageId: 'img-1', newName: 'renamed' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['image', 'workspace', 'ws-1'] })
  })
})

// ─── useRemoveImageFile ───────────────────────────────────────
describe('useRemoveImageFile', () => {
  it('성공 시 ["image", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockRemove.mockResolvedValue({ success: true, data: undefined })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveImageFile(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', imageId: 'img-1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['image', 'workspace', 'ws-1'] })
  })
})

// ─── useReadImageContent ──────────────────────────────────────
describe('useReadImageContent', () => {
  it('성공 시 { data: ArrayBuffer } 반환', async () => {
    mockReadContent.mockResolvedValue({ success: true, data: { data: new ArrayBuffer(8) } })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReadImageContent('ws-1', 'img-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.data).toBeDefined()
  })

  it('workspaceId=""이면 queryFn을 호출하지 않는다 (enabled=false)', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useReadImageContent('', 'img-1'), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(mockReadContent).not.toHaveBeenCalled()
  })

  it('imageId=""이면 queryFn을 호출하지 않는다 (enabled=false)', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useReadImageContent('ws-1', ''), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(mockReadContent).not.toHaveBeenCalled()
  })
})

// ─── useMoveImageFile ─────────────────────────────────────────
describe('useMoveImageFile', () => {
  it('성공 시 ["image", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockMove.mockResolvedValue({ success: true, data: SAMPLE_IMAGE })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useMoveImageFile(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', imageId: 'img-1', folderId: null, index: 0 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['image', 'workspace', 'ws-1'] })
  })
})

// ─── useUpdateImageMeta ───────────────────────────────────────
describe('useUpdateImageMeta', () => {
  it('성공 시 ["image", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockUpdateMeta.mockResolvedValue({
      success: true,
      data: { ...SAMPLE_IMAGE, description: 'updated' }
    })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateImageMeta(), { wrapper })
    act(() => {
      result.current.mutate({
        workspaceId: 'ws-1',
        imageId: 'img-1',
        data: { description: 'updated' }
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['image', 'workspace', 'ws-1'] })
  })
})
