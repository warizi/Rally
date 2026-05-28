import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFolderWatcher } from '../use-folder-watcher'

// ─── 테스트 헬퍼 ──────────────────────────────────────────────
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

// ─── window.api mock ──────────────────────────────────────────
let capturedCb: (workspaceId: string) => void
const mockUnsubscribe = vi.fn()
const mockOnChanged = vi.fn().mockImplementation((cb: (workspaceId: string) => void) => {
  capturedCb = cb
  return mockUnsubscribe
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as Record<string, unknown>).api = {
    folder: { onChanged: mockOnChanged }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

// ─── 구독 등록 ────────────────────────────────────────────────
describe('구독 등록', () => {
  it('마운트 시 window.api.folder.onChanged가 1회 호출된다', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useFolderWatcher(), { wrapper })
    expect(mockOnChanged).toHaveBeenCalledTimes(1)
  })
})

// ─── 이벤트 수신 → invalidation ───────────────────────────────
describe('이벤트 수신 → invalidation', () => {
  it('onChanged 콜백에 workspaceId 전달 시 해당 queryKey를 invalidate한다', () => {
    const { queryClient, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHook(() => useFolderWatcher(), { wrapper })

    act(() => {
      capturedCb('ws-1')
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['folder', 'tree', 'ws-1'] })
  })
})

// ─── 언마운트 cleanup ─────────────────────────────────────────
describe('언마운트 cleanup', () => {
  it('언마운트 시 onChanged가 반환한 unsubscribe 함수가 호출된다', () => {
    const { wrapper } = createWrapper()
    const { unmount } = renderHook(() => useFolderWatcher(), { wrapper })

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
