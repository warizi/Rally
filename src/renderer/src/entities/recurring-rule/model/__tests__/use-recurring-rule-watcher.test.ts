import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRecurringRuleWatcher } from '../use-recurring-rule-watcher'

function createWrapper(): {
  queryClient: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

let ruleCb: (workspaceId: string) => void
let completionCb: (workspaceId: string) => void
const mockUnsubRule = vi.fn()
const mockUnsubCompletion = vi.fn()
const mockRuleOnChanged = vi.fn().mockImplementation((cb: (workspaceId: string) => void) => {
  ruleCb = cb
  return mockUnsubRule
})
const mockCompletionOnChanged = vi.fn().mockImplementation((cb: (workspaceId: string) => void) => {
  completionCb = cb
  return mockUnsubCompletion
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as Record<string, unknown>).api = {
    recurringRule: { onChanged: mockRuleOnChanged },
    recurringCompletion: { onChanged: mockCompletionOnChanged }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('useRecurringRuleWatcher', () => {
  it('마운트 시 두 채널 onChanged가 각 1회 호출된다', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useRecurringRuleWatcher(), { wrapper })
    expect(mockRuleOnChanged).toHaveBeenCalledTimes(1)
    expect(mockCompletionOnChanged).toHaveBeenCalledTimes(1)
  })

  it('recurring-rule:changed 수신 시 recurring-rule workspace/today + todo + history invalidate', () => {
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useRecurringRuleWatcher(), { wrapper })
    act(() => {
      ruleCb('ws-1')
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['recurring-rule', 'workspace', 'ws-1']
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recurring-rule', 'today', 'ws-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['todo', 'ws-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['history', 'ws-1'] })
  })

  it('recurring-completion:changed 수신 시도 동일한 키 invalidate', () => {
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useRecurringRuleWatcher(), { wrapper })
    act(() => {
      completionCb('ws-2')
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['recurring-completion', 'today', 'ws-2']
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['todo', 'ws-2'] })
  })

  it('언마운트 시 두 unsubscribe가 모두 호출된다', () => {
    const { wrapper } = createWrapper()
    const { unmount } = renderHook(() => useRecurringRuleWatcher(), { wrapper })
    unmount()
    expect(mockUnsubRule).toHaveBeenCalledTimes(1)
    expect(mockUnsubCompletion).toHaveBeenCalledTimes(1)
  })
})
