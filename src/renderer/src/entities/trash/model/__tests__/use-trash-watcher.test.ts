/**
 * useTrashWatcher 테스트 — push 이벤트 → 11종 도메인 query 키 무효화.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useTrashWatcher } from '../use-trash-watcher'

beforeEach(() => {
  const unsub = vi.fn()
  const onChanged = vi.fn(() => unsub)
  ;(window as unknown as Record<string, unknown>).api = {
    trash: { onChanged }
  }
  ;(globalThis as unknown as Record<string, unknown>).__trashWatcherMocks = { unsub, onChanged }
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
  delete (globalThis as unknown as Record<string, unknown>).__trashWatcherMocks
})

function makeWrapper(): { wrapper: ({ children }: { children: ReactNode }) => ReactElement; qc: QueryClient } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('useTrashWatcher', () => {
  it('mount → 콜백에서 11+ 종 도메인 키 무효화 + unmount → unsub', () => {
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = renderHook(() => useTrashWatcher(), { wrapper })

    const m = (globalThis as unknown as { __trashWatcherMocks: { unsub: ReturnType<typeof vi.fn>; onChanged: ReturnType<typeof vi.fn> } }).__trashWatcherMocks
    const cb = m.onChanged.mock.calls[0][0] as () => void
    cb()

    for (const key of [
      'trash', 'note', 'csv', 'pdf', 'image', 'folder', 'todo',
      'canvas', 'schedule', 'recurringRule', 'entityLink', 'history'
    ]) {
      expect(invSpy).toHaveBeenCalledWith({ queryKey: [key] })
    }

    unmount()
    expect(m.unsub).toHaveBeenCalled()
  })
})
