/**
 * entities/recurring-completion/api/queries.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import {
  useRecurringCompletionsToday,
  useCompleteRecurring,
  RECURRING_COMPLETION_KEY
} from '../queries'
import type { RecurringCompletionItem } from '../../model/types'

const COMP_RAW = {
  id: 'comp-1',
  ruleId: 'rule-1',
  ruleTitle: 'Daily',
  workspaceId: 'ws-1',
  completedDate: '2026-05-29',
  completedAt: '2026-05-29T10:00:00.000Z',
  createdAt: '2026-05-29T10:00:00.000Z'
} as unknown as RecurringCompletionItem

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    recurringCompletion: { findTodayByWorkspace: vi.fn(), complete: vi.fn() }
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

describe('useRecurringCompletionsToday', () => {
  it('성공 → completedAt/createdAt Date 변환', async () => {
    vi.mocked(api().recurringCompletion.findTodayByWorkspace).mockResolvedValue({
      success: true,
      data: [COMP_RAW]
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useRecurringCompletionsToday('ws-1', new Date()), {
      wrapper
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].completedAt).toBeInstanceOf(Date)
    expect(result.current.data?.[0].createdAt).toBeInstanceOf(Date)
  })

  it('workspaceId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useRecurringCompletionsToday(undefined, new Date()), { wrapper })
    expect(api().recurringCompletion.findTodayByWorkspace).not.toHaveBeenCalled()
  })
})

describe('useCompleteRecurring', () => {
  it('성공 → 4종 키 무효화 (completion-today + todo completedWithRecurring + todo + history)', async () => {
    vi.mocked(api().recurringCompletion.complete).mockResolvedValue({
      success: true,
      data: COMP_RAW
    })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const date = new Date('2026-05-29')
    const { result } = renderHook(() => useCompleteRecurring(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', ruleId: 'rule-1', date })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invSpy).toHaveBeenCalledWith({
      queryKey: [RECURRING_COMPLETION_KEY, 'today', 'ws-1', '2026-05-29']
    })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['todo', 'completedWithRecurring', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['todo', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history', 'ws-1'] })
  })
})
