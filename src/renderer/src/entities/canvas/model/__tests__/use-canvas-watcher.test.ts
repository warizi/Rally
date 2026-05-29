/**
 * useCanvasWatcher 테스트 — push 이벤트 → 4종 query 키 무효화.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useCanvasWatcher } from '../use-canvas-watcher'

beforeEach(() => {
  const unsub = vi.fn()
  const onChanged = vi.fn(() => unsub)
  ;(window as unknown as Record<string, unknown>).api = {
    canvas: { onChanged }
  }
  ;(globalThis as unknown as Record<string, unknown>).__canvasWatcherMocks = { unsub, onChanged }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
  delete (globalThis as unknown as Record<string, unknown>).__canvasWatcherMocks
})

function makeWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement
  qc: QueryClient
} {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('useCanvasWatcher', () => {
  it('mount → onChanged 구독 + 콜백에서 4종 키 무효화 + unmount → unsub', () => {
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = renderHook(() => useCanvasWatcher(), { wrapper })

    const m = (
      globalThis as unknown as {
        __canvasWatcherMocks: {
          unsub: ReturnType<typeof vi.fn>
          onChanged: ReturnType<typeof vi.fn>
        }
      }
    ).__canvasWatcherMocks
    expect(m.onChanged).toHaveBeenCalled()
    const cb = m.onChanged.mock.calls[0][0] as (workspaceId: string) => void
    cb('ws-1')

    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['canvas', 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['canvas', 'detail'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['canvasNode'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['canvasEdge'] })

    unmount()
    expect(m.unsub).toHaveBeenCalled()
  })
})
