import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useNotesByWorkspace,
  useCreateNote,
  useRenameNote,
  useRemoveNote,
  useReadNoteContent,
  useWriteNoteContent,
  useMoveNote,
  useUpdateNoteMeta
} from '../queries'
import type { NoteNode } from '../../model/types'

// ─── window.api mock ──────────────────────────────────────────
const mockReadByWorkspace = vi.fn()
const mockCreate = vi.fn()
const mockRename = vi.fn()
const mockRemove = vi.fn()
const mockReadContent = vi.fn()
const mockWriteContent = vi.fn()
const mockMove = vi.fn()
const mockUpdateMeta = vi.fn()

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    note: {
      readByWorkspace: mockReadByWorkspace,
      create: mockCreate,
      rename: mockRename,
      remove: mockRemove,
      readContent: mockReadContent,
      writeContent: mockWriteContent,
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

const SAMPLE_NOTE: NoteNode = {
  id: 'n1',
  title: 'My Note',
  relativePath: 'my-note.md',
  description: '',
  preview: '',
  folderId: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date()
}

// ─── useNotesByWorkspace ──────────────────────────────────────
describe('useNotesByWorkspace', () => {
  it('성공 시 data를 반환한다', async () => {
    mockReadByWorkspace.mockResolvedValue({ success: true, data: [SAMPLE_NOTE] })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useNotesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].id).toBe('n1')
  })

  it('IPC success:false면 error 상태가 된다', async () => {
    mockReadByWorkspace.mockResolvedValue({
      success: false,
      errorType: 'NotFoundError',
      message: 'workspace not found'
    })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useNotesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('workspaceId=""이면 queryFn을 호출하지 않는다 (enabled=false)', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useNotesByWorkspace(''), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(mockReadByWorkspace).not.toHaveBeenCalled()
  })
})

// ─── useCreateNote ───────────────────────────────────────────
describe('useCreateNote', () => {
  it('성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockCreate.mockResolvedValue({ success: true, data: SAMPLE_NOTE })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateNote(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', folderId: null, name: 'new note' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['note', 'workspace', 'ws-1'] })
  })
})

// ─── useRenameNote ───────────────────────────────────────────
describe('useRenameNote', () => {
  it('성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockRename.mockResolvedValue({ success: true, data: { ...SAMPLE_NOTE, title: 'renamed' } })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRenameNote(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', noteId: 'n1', newName: 'renamed' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['note', 'workspace', 'ws-1'] })
  })
})

// ─── useRemoveNote ───────────────────────────────────────────
describe('useRemoveNote', () => {
  it('성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockRemove.mockResolvedValue({ success: true, data: undefined })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveNote(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', noteId: 'n1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['note', 'workspace', 'ws-1'] })
  })
})

// ─── useReadNoteContent ──────────────────────────────────────
describe('useReadNoteContent', () => {
  it('성공 시 파일 내용 문자열을 반환한다', async () => {
    mockReadContent.mockResolvedValue({ success: true, data: '# Hello' })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useReadNoteContent('ws-1', 'n1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('# Hello')
  })

  it('workspaceId=""이면 queryFn을 호출하지 않는다 (enabled=false)', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useReadNoteContent('', 'n1'), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(mockReadContent).not.toHaveBeenCalled()
  })

  it('noteId=""이면 queryFn을 호출하지 않는다 (enabled=false)', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => useReadNoteContent('ws-1', ''), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(mockReadContent).not.toHaveBeenCalled()
  })
})

// ─── useWriteNoteContent ─────────────────────────────────────
describe('useWriteNoteContent', () => {
  it('성공 시 queryClient.setQueryData(["note", "content", noteId], content)를 호출한다', async () => {
    mockWriteContent.mockResolvedValue({ success: true, data: undefined })
    const { queryClient, wrapper } = createWrapper()
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData')

    const { result } = renderHook(() => useWriteNoteContent(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', noteId: 'n1', content: '# New Content' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(setDataSpy).toHaveBeenCalledWith(['note', 'content', 'n1'], '# New Content')
  })
})

// ─── useMoveNote ─────────────────────────────────────────────
describe('useMoveNote', () => {
  it('성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockMove.mockResolvedValue({ success: true, data: SAMPLE_NOTE })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useMoveNote(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', noteId: 'n1', folderId: null, index: 0 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['note', 'workspace', 'ws-1'] })
  })
})

// ─── useUpdateNoteMeta ───────────────────────────────────────
describe('useUpdateNoteMeta', () => {
  it('성공 시 ["note", "workspace", workspaceId] queryKey를 invalidate한다', async () => {
    mockUpdateMeta.mockResolvedValue({
      success: true,
      data: { ...SAMPLE_NOTE, description: 'updated' }
    })
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateNoteMeta(), { wrapper })
    act(() => {
      result.current.mutate({ workspaceId: 'ws-1', noteId: 'n1', data: { description: 'updated' } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['note', 'workspace', 'ws-1'] })
  })
})
