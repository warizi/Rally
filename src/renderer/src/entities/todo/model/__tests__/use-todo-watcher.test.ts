/**
 * useTodoWatcher 회귀 테스트 (Todo 갭 분석 P2).
 *
 * - MainLayout 마운트 시 window.api.todo.onChanged 구독
 * - push 이벤트 수신 시 4종 React Query 키 무효화
 * - unmount 시 unsubscribe
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useTodoWatcher } from '../use-todo-watcher'

beforeEach(() => {
  const unsubMock = vi.fn()
  const onChangedMock = vi.fn(() => unsubMock)
  ;(window as unknown as Record<string, unknown>).api = {
    todo: { onChanged: onChangedMock }
  }
  // 테스트에서 접근 편의용 stash
  ;(globalThis as unknown as Record<string, unknown>).__unsubMock = unsubMock
  ;(globalThis as unknown as Record<string, unknown>).__onChangedMock = onChangedMock
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).api
  delete (globalThis as unknown as Record<string, unknown>).__unsubMock
  delete (globalThis as unknown as Record<string, unknown>).__onChangedMock
})

function makeWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement
  client: QueryClient
} {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }): ReactElement =>
    createElement(QueryClientProvider, { client }, children)
  return { wrapper, client }
}

describe('useTodoWatcher', () => {
  it('mount → window.api.todo.onChanged 구독', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useTodoWatcher(), { wrapper })
    const onChangedMock = (globalThis as unknown as { __onChangedMock: ReturnType<typeof vi.fn> })
      .__onChangedMock
    expect(onChangedMock).toHaveBeenCalledTimes(1)
    expect(onChangedMock).toHaveBeenCalledWith(expect.any(Function))
  })

  it('push 이벤트 수신 시 4 종 query 무효화 (workspace / dateRange / completed / history)', () => {
    const { wrapper, client } = makeWrapper()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    renderHook(() => useTodoWatcher(), { wrapper })

    const onChangedMock = (globalThis as unknown as { __onChangedMock: ReturnType<typeof vi.fn> })
      .__onChangedMock
    const callback = onChangedMock.mock.calls[0][0] as (workspaceId: string) => void
    callback('ws-aabbcc12')

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['todo', 'workspace', 'ws-aabbcc12']
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['todo', 'dateRange', 'ws-aabbcc12']
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['todo', 'ws-aabbcc12']
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['history', 'ws-aabbcc12']
    })
  })

  it('unmount → unsubscribe 호출', () => {
    const { wrapper } = makeWrapper()
    const { unmount } = renderHook(() => useTodoWatcher(), { wrapper })

    const unsubMock = (globalThis as unknown as { __unsubMock: ReturnType<typeof vi.fn> })
      .__unsubMock
    expect(unsubMock).not.toHaveBeenCalled()
    unmount()
    expect(unsubMock).toHaveBeenCalled()
  })
})
