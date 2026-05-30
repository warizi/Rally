/**
 * entities/recurring-completion/api/queries.test.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import {
  RECURRING_COMPLETION_KEY,
  useRecurringCompletionsToday,
  useCompleteRecurring
} from '../queries'

const mocks = vi.hoisted(() => ({
  findToday: vi.fn(),
  complete: vi.fn()
}))

function wrapper({ children }: { children: ReactNode }): ReactElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mocks.findToday.mockReset()
  mocks.complete.mockReset()
  ;(window as unknown as Record<string, unknown>).api = {
    recurringCompletion: {
      findTodayByWorkspace: mocks.findToday,
      complete: mocks.complete
    }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('RECURRING_COMPLETION_KEY', () => {
  it('queryKey prefix', () => {
    expect(RECURRING_COMPLETION_KEY).toBe('recurring-completion')
  })
})

describe('useRecurringCompletionsToday', () => {
  it('workspaceId 없으면 enabled=false → 호출 안 함', async () => {
    const { result } = renderHook(() => useRecurringCompletionsToday(null, new Date()), {
      wrapper
    })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(mocks.findToday).not.toHaveBeenCalled()
  })

  it('성공 → completedAt/createdAt Date 변환', async () => {
    mocks.findToday.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'c1',
          ruleId: 'r1',
          ruleTitle: '운동',
          workspaceId: 'ws1',
          completedDate: '2026-05-30',
          completedAt: '2026-05-30T10:00:00.000Z',
          createdAt: '2026-05-30T10:00:00.000Z'
        }
      ]
    })
    const { result } = renderHook(
      () => useRecurringCompletionsToday('ws1', new Date('2026-05-30T00:00:00Z')),
      { wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].completedAt).toBeInstanceOf(Date)
    expect(result.current.data?.[0].createdAt).toBeInstanceOf(Date)
  })

  it('실패 응답 → error', async () => {
    mocks.findToday.mockResolvedValue({ success: false, error: { code: 'ERR', message: 'x' } })
    const { result } = renderHook(
      () => useRecurringCompletionsToday('ws1', new Date('2026-05-30T00:00:00Z')),
      { wrapper }
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCompleteRecurring', () => {
  it('mutate → window.api.complete 호출', async () => {
    mocks.complete.mockResolvedValue({
      success: true,
      data: {
        id: 'c2',
        ruleId: 'r2',
        ruleTitle: 't',
        workspaceId: 'ws1',
        completedDate: '2026-05-30',
        completedAt: '2026-05-30T10:00:00.000Z',
        createdAt: '2026-05-30T10:00:00.000Z'
      }
    })
    const { result } = renderHook(() => useCompleteRecurring(), { wrapper })
    let returned: { completedAt: Date } | undefined
    await act(async () => {
      returned = await result.current.mutateAsync({
        workspaceId: 'ws1',
        ruleId: 'r2',
        date: new Date('2026-05-30T00:00:00Z')
      })
    })
    expect(mocks.complete).toHaveBeenCalledWith('r2', expect.any(Date))
    expect(returned?.completedAt).toBeInstanceOf(Date)
  })

  it('mutation 실패 → error', async () => {
    mocks.complete.mockResolvedValue({ success: false, error: { code: 'E', message: 'fail' } })
    const { result } = renderHook(() => useCompleteRecurring(), { wrapper })
    await expect(
      result.current.mutateAsync({
        workspaceId: 'ws1',
        ruleId: 'r2',
        date: new Date('2026-05-30T00:00:00Z')
      })
    ).rejects.toThrow()
  })
})
