/**
 * 노트 스타일 템플릿 React Query 훅 테스트.
 *
 * IPC mock (window.api.noteStyleTemplate) + useQuery / useMutation 동작 검증.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useNoteStyleTemplates,
  useCreateNoteStyleTemplate,
  useDeleteNoteStyleTemplate
} from '../templates'

function createWrapper(): {
  qc: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

let listMock: ReturnType<typeof vi.fn>
let createMock: ReturnType<typeof vi.fn>
let removeMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  listMock = vi.fn().mockResolvedValue({ success: true, data: [] })
  createMock = vi.fn().mockResolvedValue({ success: true, data: { id: 'new-id' } })
  removeMock = vi.fn().mockResolvedValue({ success: true })
  ;(window as unknown as Record<string, unknown>).api = {
    noteStyleTemplate: { list: listMock, create: createMock, remove: removeMock }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('useNoteStyleTemplates', () => {
  it('빈 목록 반환', async () => {
    const { result } = renderHook(() => useNoteStyleTemplates(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.templates).toEqual([])
  })

  it('createdAt 을 Date 로 정규화', async () => {
    const isoString = '2026-01-15T10:00:00.000Z'
    listMock.mockResolvedValueOnce({
      success: true,
      data: [{ id: 't1', name: 'A', settingsJson: '{}', createdAt: isoString }]
    })

    const { result } = renderHook(() => useNoteStyleTemplates(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.templates.length).toBeGreaterThan(0))
    expect(result.current.templates[0].createdAt).toBeInstanceOf(Date)
    expect(result.current.templates[0].createdAt.toISOString()).toBe(isoString)
  })

  it('IPC 실패 시 빈 배열', async () => {
    listMock.mockResolvedValueOnce({ success: false, message: 'fail' })
    const { result } = renderHook(() => useNoteStyleTemplates(), {
      wrapper: createWrapper().wrapper
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.templates).toEqual([])
  })
})

describe('useCreateNoteStyleTemplate', () => {
  it('create 호출 → IPC create + 캐시 invalidate', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(
      () => ({
        list: useNoteStyleTemplates(),
        create: useCreateNoteStyleTemplate()
      }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.list.isLoading).toBe(false))
    expect(listMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.create.create({ name: '미니멀', settingsJson: '{}' })
    })

    expect(createMock).toHaveBeenCalledWith({ name: '미니멀', settingsJson: '{}' })
    // invalidate 로 list refetch 발생
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2))
  })

  it('IPC 실패 시 throw', async () => {
    createMock.mockResolvedValueOnce({ success: false, message: '중복' })
    const { result } = renderHook(() => useCreateNoteStyleTemplate(), {
      wrapper: createWrapper().wrapper
    })

    await expect(result.current.create({ name: 'dup', settingsJson: '{}' })).rejects.toThrow('중복')
  })
})

describe('useDeleteNoteStyleTemplate', () => {
  it('remove 호출 → IPC remove + 캐시 invalidate', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(
      () => ({
        list: useNoteStyleTemplates(),
        del: useDeleteNoteStyleTemplate()
      }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.list.isLoading).toBe(false))

    await act(async () => {
      await result.current.del.remove('t-id')
    })

    expect(removeMock).toHaveBeenCalledWith('t-id')
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2))
  })
})
