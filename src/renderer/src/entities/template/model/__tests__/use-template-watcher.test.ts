import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTemplateWatcher } from '../use-template-watcher'

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
    template: { onChanged: mockOnChanged }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('useTemplateWatcher', () => {
  it('마운트 시 onChanged가 1회 호출된다', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useTemplateWatcher(), { wrapper })
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })

  it('onChanged 수신 시 template list 키를 workspaceId 기준으로 invalidate한다', () => {
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useTemplateWatcher(), { wrapper })
    act(() => {
      capturedCb('ws-1')
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['template', 'list', 'ws-1'] })
  })

  it('언마운트 시 unsubscribe가 호출된다', () => {
    const { wrapper } = createWrapper()
    const { unmount } = renderHook(() => useTemplateWatcher(), { wrapper })
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
