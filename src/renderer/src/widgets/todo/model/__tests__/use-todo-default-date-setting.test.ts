/**
 * widgets/todo/model/use-todo-default-date-setting.test.ts
 *
 * use-show-extension-setting 과 동일 패턴. settings IPC boolean toggle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useTodoDefaultDateSetting } from '../use-todo-default-date-setting'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    settings: { get: vi.fn(), set: vi.fn() }
  }
  vi.clearAllMocks()
})

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

function makeWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement
  qc: QueryClient
} {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('useTodoDefaultDateSetting', () => {
  it('data="true" → enabled=true', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: 'true' })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTodoDefaultDateSetting(), { wrapper })
    await waitFor(() => expect(result.current.enabled).toBe(true))
  })

  it('data="false" → enabled=false', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: 'false' })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTodoDefaultDateSetting(), { wrapper })
    await waitFor(() => expect(result.current.enabled).toBe(false))
  })

  it('setEnabled → settings.set + invalidate', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: 'false' })
    vi.mocked(api().settings.set).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useTodoDefaultDateSetting(), { wrapper })
    await act(async () => {
      await result.current.setEnabled(true)
    })
    expect(api().settings.set).toHaveBeenCalledWith('todo.create.default.date.today', 'true')
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['todoDefaultDateToday'] })
  })
})
