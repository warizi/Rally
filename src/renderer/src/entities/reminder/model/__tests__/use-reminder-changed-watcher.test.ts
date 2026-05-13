import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useReminderChangedWatcher } from '../use-reminder-changed-watcher'

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
    reminder: { onChanged: mockOnChanged }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('useReminderChangedWatcher', () => {
  it('마운트 시 onChanged가 1회 호출된다', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useReminderChangedWatcher(), { wrapper })
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it('onChanged 수신 시 reminder 도메인 전체 invalidate한다', () => {
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useReminderChangedWatcher(), { wrapper })
    act(() => {
      capturedCb('ws-1')
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reminder'] })
  })

  it('언마운트 시 unsubscribe가 호출된다', () => {
    const { wrapper } = createWrapper()
    const { unmount } = renderHook(() => useReminderChangedWatcher(), { wrapper })
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
