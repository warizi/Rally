import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCanvasNodeRefSync } from '../use-canvas-node-ref-sync'

function createWrapper(): {
  queryClient: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// 도메인별 onChanged 콜백 캡처
const captured: Record<string, (...args: unknown[]) => void> = {}
const unsub = vi.fn()
function mkOnChanged(domain: string) {
  return (cb: (...args: unknown[]) => void) => {
    captured[domain] = cb
    return unsub
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as Record<string, unknown>).api = {
    note: { onChanged: mkOnChanged('note') },
    csv: { onChanged: mkOnChanged('csv') },
    pdf: { onChanged: mkOnChanged('pdf') },
    image: { onChanged: mkOnChanged('image') },
    todo: { onChanged: mkOnChanged('todo') },
    schedule: { onChanged: mkOnChanged('schedule') }
  }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
})

describe('useCanvasNodeRefSync', () => {
  it('참조 도메인 6종 onChanged 를 구독한다', () => {
    const { wrapper } = createWrapper()
    renderHook(() => useCanvasNodeRefSync(), { wrapper })
    for (const d of ['note', 'csv', 'pdf', 'image', 'todo', 'schedule']) {
      expect(captured[d]).toBeTypeOf('function')
    }
  })

  it('참조 도메인 변경 수신 → ["canvasNode"] invalidate', () => {
    const { wrapper, queryClient } = createWrapper()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    renderHook(() => useCanvasNodeRefSync(), { wrapper })

    act(() => captured.note('ws-1', ['a.md'], null))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['canvasNode'] })

    spy.mockClear()
    act(() => captured.todo('ws-1'))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['canvasNode'] })
  })

  it('언마운트 시 모든 구독 해제', () => {
    const { wrapper } = createWrapper()
    const { unmount } = renderHook(() => useCanvasNodeRefSync(), { wrapper })
    unmount()
    expect(unsub).toHaveBeenCalledTimes(6)
  })
})
