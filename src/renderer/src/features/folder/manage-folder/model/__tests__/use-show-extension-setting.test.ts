/**
 * features/folder/manage-folder/model/use-show-extension-setting.test.ts
 *
 * settings IPC 로 boolean toggle 영속.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useShowExtensionSetting } from '../use-show-extension-setting'

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

describe('useShowExtensionSetting', () => {
  it('data="true" → enabled=true', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: 'true' })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useShowExtensionSetting(), { wrapper })
    await waitFor(() => expect(result.current.enabled).toBe(true))
  })

  it('data="false" → enabled=false', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: 'false' })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useShowExtensionSetting(), { wrapper })
    await waitFor(() => expect(result.current.enabled).toBe(false))
  })

  it('IPC 실패 → enabled=false (기본)', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: 'no'
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useShowExtensionSetting(), { wrapper })
    await waitFor(() => expect(result.current.enabled).toBe(false))
  })

  it('setEnabled → settings.set String(value) + invalidate', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: 'false' })
    vi.mocked(api().settings.set).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useShowExtensionSetting(), { wrapper })
    await act(async () => {
      await result.current.setEnabled(true)
    })
    expect(api().settings.set).toHaveBeenCalledWith('fileExplorer.showExtension', 'true')
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['fileExplorerShowExtension'] })
  })
})
