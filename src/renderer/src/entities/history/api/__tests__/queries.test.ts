/**
 * entities/history/api/queries.test.ts — infinite query 로 페이지네이션.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useHistoryInfinite } from '../queries'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    history: { fetch: vi.fn() }
  }
  vi.clearAllMocks()
})

function makeWrapper(): { wrapper: ({ children }: { children: ReactNode }) => ReactElement; qc: QueryClient } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('useHistoryInfinite', () => {
  it('첫 페이지 fetch → dayOffset=0 + doneAt Date 변환', async () => {
    // Backend response 의 doneAt 은 직렬화되어 string. queries 가 Date 로 재변환.
    vi.mocked(api().history.fetch).mockResolvedValue({
      success: true,
      data: {
        days: [
          {
            date: '2026-05-29',
            todos: [
              {
                id: 't1',
                title: 'X',
                doneAt: '2026-05-29T10:00:00.000Z',
                kind: 'todo',
                links: [],
                parentId: null,
                parentTitle: null,
                createdBy: 'user',
                createdById: null,
                updatedBy: 'user',
                updatedById: null
              } as unknown as Parameters<typeof Object>[0]
            ]
          }
        ],
        hasMore: false,
        nextDayOffset: 1
      }
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useHistoryInfinite({ workspaceId: 'ws-1' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(api().history.fetch).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ dayOffset: 0, dayLimit: 10 })
    )
    const firstPage = result.current.data!.pages[0]
    expect(firstPage.days[0].todos[0].doneAt).toBeInstanceOf(Date)
  })

  it('workspaceId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useHistoryInfinite({ workspaceId: '' }), { wrapper })
    expect(api().history.fetch).not.toHaveBeenCalled()
  })

  it('hasMore=false → getNextPageParam 가 undefined → hasNextPage=false', async () => {
    vi.mocked(api().history.fetch).mockResolvedValue({
      success: true,
      data: { days: [], hasMore: false, nextDayOffset: 0 }
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useHistoryInfinite({ workspaceId: 'ws-1' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(false)
  })
})
