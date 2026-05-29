/**
 * entities/trash/api/queries.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useTrashList, useTrashCount, useTrashRetention } from '../queries'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    trash: { list: vi.fn(), count: vi.fn(), getRetention: vi.fn() }
  }
  vi.clearAllMocks()
})

function makeWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement
  qc: QueryClient
} {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('trash queries', () => {
  it('useTrashList → options 전달', async () => {
    vi.mocked(api().trash.list).mockResolvedValue({
      success: true,
      data: { batches: [], total: 0, hasMore: false, nextOffset: 0 }
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTrashList('ws-1', { limit: 10 }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().trash.list).toHaveBeenCalledWith('ws-1', { limit: 10 })
  })

  it('useTrashList → empty data fallback', async () => {
    vi.mocked(api().trash.list).mockResolvedValue({ success: true, data: undefined })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTrashList('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.batches).toEqual([])
  })

  it('useTrashCount → 결과 반환', async () => {
    vi.mocked(api().trash.count).mockResolvedValue({ success: true, data: 42 })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTrashCount('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(42)
  })

  it('useTrashRetention → 결과 반환', async () => {
    vi.mocked(api().trash.getRetention).mockResolvedValue({ success: true, data: '30' })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTrashRetention(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('30')
  })
})
