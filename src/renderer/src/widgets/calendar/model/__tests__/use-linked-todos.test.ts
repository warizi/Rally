/**
 * widgets/calendar/model/use-linked-todos.test.ts
 *
 * schedule ↔ todo 링크 관리 hooks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useLinkedTodos, useLinkTodo, useUnlinkTodo } from '../use-linked-todos'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    schedule: {
      getLinkedTodos: vi.fn(),
      linkTodo: vi.fn(),
      unlinkTodo: vi.fn()
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

describe('useLinkedTodos', () => {
  it('성공 → data 반환', async () => {
    vi.mocked(api().schedule.getLinkedTodos).mockResolvedValue({
      success: true,
      data: []
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useLinkedTodos('sch-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().schedule.getLinkedTodos).toHaveBeenCalledWith('sch-1')
  })

  it('scheduleId undefined → disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useLinkedTodos(undefined), { wrapper })
    expect(api().schedule.getLinkedTodos).not.toHaveBeenCalled()
  })
})

describe('useLinkTodo / useUnlinkTodo', () => {
  it('useLinkTodo → linkTodo + linkedTodos 무효화', async () => {
    vi.mocked(api().schedule.linkTodo).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useLinkTodo(), { wrapper })
    await act(async () => {
      result.current.mutate({ scheduleId: 'sch-1', todoId: 't-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().schedule.linkTodo).toHaveBeenCalledWith('sch-1', 't-1')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['schedule', 'linkedTodos', 'sch-1'] })
  })

  it('useUnlinkTodo → unlinkTodo + linkedTodos 무효화', async () => {
    vi.mocked(api().schedule.unlinkTodo).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUnlinkTodo(), { wrapper })
    await act(async () => {
      result.current.mutate({ scheduleId: 'sch-1', todoId: 't-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().schedule.unlinkTodo).toHaveBeenCalledWith('sch-1', 't-1')
    expect(inv).toHaveBeenCalledWith({ queryKey: ['schedule', 'linkedTodos', 'sch-1'] })
  })
})
