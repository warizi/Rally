/**
 * useEntityLinkWatcher 테스트 — entity-link push → entityLink + history 무효화.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useEntityLinkWatcher } from '../use-entity-link-watcher'

beforeEach(() => {
  const unsub = vi.fn()
  const onChanged = vi.fn(() => unsub)
  ;(window as unknown as Record<string, unknown>).api = {
    entityLink: { onChanged }
  }
  ;(globalThis as unknown as Record<string, unknown>).__elWatcherMocks = { unsub, onChanged }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
  delete (globalThis as unknown as Record<string, unknown>).__elWatcherMocks
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

describe('useEntityLinkWatcher', () => {
  it('mount → 콜백에서 entityLink + history 무효화 + unmount → unsub', () => {
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = renderHook(() => useEntityLinkWatcher(), { wrapper })

    const m = (
      globalThis as unknown as {
        __elWatcherMocks: { unsub: ReturnType<typeof vi.fn>; onChanged: ReturnType<typeof vi.fn> }
      }
    ).__elWatcherMocks
    const cb = m.onChanged.mock.calls[0][0] as () => void
    cb()

    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['entityLink'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history'] })

    unmount()
    expect(m.unsub).toHaveBeenCalled()
  })
})
