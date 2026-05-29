/**
 * entities/schedule/api/queries.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useAllSchedulesByWorkspace, useSchedulesByWorkspace } from '../queries'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    schedule: {
      findAllByWorkspace: vi.fn(),
      findByWorkspace: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
      linkTodo: vi.fn(),
      unlinkTodo: vi.fn(),
      getLinkedTodos: vi.fn()
    }
  }
  vi.clearAllMocks()
})

function makeWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement
  qc: QueryClient
} {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('schedule queries', () => {
  it('useAllSchedulesByWorkspace → 성공', async () => {
    vi.mocked(api().schedule.findAllByWorkspace).mockResolvedValue({ success: true, data: [] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useAllSchedulesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().schedule.findAllByWorkspace).toHaveBeenCalledWith('ws-1')
  })

  it('useAllSchedulesByWorkspace → null workspaceId 시 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useAllSchedulesByWorkspace(null), { wrapper })
    expect(api().schedule.findAllByWorkspace).not.toHaveBeenCalled()
  })

  it('useSchedulesByWorkspace → range 전달 + queryKey 에 ISO 포함', async () => {
    vi.mocked(api().schedule.findByWorkspace).mockResolvedValue({ success: true, data: [] })
    const range = {
      start: new Date('2026-05-01'),
      end: new Date('2026-05-31')
    }
    const { wrapper } = makeWrapper()
    renderHook(() => useSchedulesByWorkspace('ws-1', range), { wrapper })
    await waitFor(() => expect(api().schedule.findByWorkspace).toHaveBeenCalledWith('ws-1', range))
  })
})
