/**
 * widgets/recurring/model/queries.test.ts
 *
 * useCompletedWithRecurring — todo + recurring 완료 통합 fetch + Date 역직렬화.
 * useUncompleteRecurring — 완료 해제 + 4종 key 무효화.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useCompletedWithRecurring, useUncompleteRecurring } from '../queries'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    todo: { findCompletedWithRecurring: vi.fn() },
    recurringCompletion: { uncomplete: vi.fn() }
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

const NOW = new Date('2026-05-29').toISOString()

describe('useCompletedWithRecurring', () => {
  it('workspaceId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useCompletedWithRecurring(undefined), { wrapper })
    expect(api().todo.findCompletedWithRecurring).not.toHaveBeenCalled()
  })

  it('todo 항목 → Date 필드 역직렬화', async () => {
    vi.mocked(api().todo.findCompletedWithRecurring).mockResolvedValue({
      success: true,
      data: [
        {
          type: 'todo',
          completedAt: NOW,
          todo: {
            id: 't-1',
            createdAt: NOW,
            updatedAt: NOW,
            doneAt: NOW,
            dueDate: null,
            startDate: NOW
          }
        }
      ]
    } as unknown as ReturnType<typeof api>['todo']['findCompletedWithRecurring'] extends (
      ...args: unknown[]
    ) => infer R
      ? Awaited<R>
      : never)
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCompletedWithRecurring('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const items = result.current.data!
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('todo')
    if (items[0].type === 'todo') {
      expect(items[0].todo.createdAt).toBeInstanceOf(Date)
      expect(items[0].todo.dueDate).toBeNull()
      expect(items[0].todo.startDate).toBeInstanceOf(Date)
    }
  })

  it('recurring 항목 → recurringCompletion Date 역직렬화', async () => {
    vi.mocked(api().todo.findCompletedWithRecurring).mockResolvedValue({
      success: true,
      data: [
        {
          type: 'recurring',
          completedAt: NOW,
          recurringCompletion: {
            id: 'rc-1',
            completedAt: NOW,
            createdAt: NOW
          }
        }
      ]
    } as unknown as ReturnType<typeof api>['todo']['findCompletedWithRecurring'] extends (
      ...args: unknown[]
    ) => infer R
      ? Awaited<R>
      : never)
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCompletedWithRecurring('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const items = result.current.data!
    expect(items[0].type).toBe('recurring')
    if (items[0].type === 'recurring') {
      expect(items[0].recurringCompletion.createdAt).toBeInstanceOf(Date)
    }
  })
})

describe('useUncompleteRecurring', () => {
  it('성공 → 4종 key 무효화', async () => {
    vi.mocked(api().recurringCompletion.uncomplete).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUncompleteRecurring(), { wrapper })
    const date = new Date('2026-05-29T12:00:00Z')
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', completionId: 'rc-1', date })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().recurringCompletion.uncomplete).toHaveBeenCalledWith('rc-1')
    // 4가지 invalidate
    const keys = inv.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    expect(keys).toContain(JSON.stringify(['recurring-completion', 'today', 'ws-1', '2026-05-29']))
    expect(keys).toContain(JSON.stringify(['todo', 'completedWithRecurring', 'ws-1']))
    expect(keys).toContain(JSON.stringify(['recurring-rule', 'today', 'ws-1']))
    expect(keys).toContain(JSON.stringify(['history', 'ws-1']))
  })
})
