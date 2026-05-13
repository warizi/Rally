import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useScheduleWatcher } from '../use-schedule-watcher'

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

let capturedCb: (workspaceId: string) => void
const mockUnsubscribe = vi.fn()
const mockOnChanged = vi.fn().mockImplementation((cb: (workspaceId: string) => void) => {
  capturedCb = cb
  return mockUnsubscribe
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as Record<string, unknown>).api = {
    schedule: { onChanged: mockOnChanged }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('useScheduleWatcher', () => {
  it('마운트 시 window.api.schedule.onChanged가 1회 호출된다', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useScheduleWatcher(), { wrapper })
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it('onChanged 수신 시 schedule workspace/detail/linkedTodos 키를 invalidate한다', () => {
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useScheduleWatcher(), { wrapper })
    act(() => {
      capturedCb('ws-1')
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schedule', 'workspace', 'ws-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schedule', 'detail'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schedule', 'linkedTodos'] })
  })

  it('언마운트 시 unsubscribe가 호출된다', () => {
    const { wrapper } = createWrapper()
    const { unmount } = renderHook(() => useScheduleWatcher(), { wrapper })
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
