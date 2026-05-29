/**
 * shared/hooks/use-toast-settings.test.ts
 *
 * settings IPC 로 duration / visibleCount fetch + Infinity 직렬화 fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import {
  useToastSettings,
  DEFAULT_TOAST_DURATION,
  DEFAULT_TOAST_VISIBLE_COUNT,
  TOAST_DURATION_OPTIONS,
  TOAST_VISIBLE_COUNT_OPTIONS
} from '../use-toast-settings'

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

describe('TOAST_DURATION_OPTIONS / TOAST_VISIBLE_COUNT_OPTIONS', () => {
  it('Infinity 옵션 포함', () => {
    const inf = TOAST_DURATION_OPTIONS.find((o) => o.value === Number.POSITIVE_INFINITY)
    expect(inf).toBeDefined()
  })
  it('visibleCount 옵션은 3/5/10', () => {
    expect(TOAST_VISIBLE_COUNT_OPTIONS.map((o) => o.value)).toEqual([3, 5, 10])
  })
})

describe('useToastSettings — fetch / fallback', () => {
  it('IPC 성공 → 값 반환', async () => {
    vi.mocked(api().settings.get).mockImplementation(async (key) => {
      if (key === 'toast.duration') return { success: true, data: '5000' }
      if (key === 'toast.visibleCount') return { success: true, data: '5' }
      return { success: false, errorType: 'UnknownError', message: 'x' }
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useToastSettings(), { wrapper })
    await waitFor(() => expect(result.current.duration).toBe(5000))
    expect(result.current.visibleCount).toBe(5)
  })

  it('IPC 실패 → 기본값', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: 'no'
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useToastSettings(), { wrapper })
    await waitFor(() => expect(result.current.duration).toBe(DEFAULT_TOAST_DURATION))
    expect(result.current.visibleCount).toBe(DEFAULT_TOAST_VISIBLE_COUNT)
  })

  it("Infinity 직렬화('Infinity') → Number.POSITIVE_INFINITY 복원", async () => {
    vi.mocked(api().settings.get).mockImplementation(async (key) => {
      if (key === 'toast.duration') return { success: true, data: 'Infinity' }
      return { success: true, data: '3' }
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useToastSettings(), { wrapper })
    await waitFor(() => expect(result.current.duration).toBe(Number.POSITIVE_INFINITY))
  })

  it('잘못된 값 (NaN/음수) → 기본값', async () => {
    vi.mocked(api().settings.get).mockImplementation(async (key) => {
      if (key === 'toast.duration') return { success: true, data: 'abc' }
      return { success: true, data: '-1' }
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useToastSettings(), { wrapper })
    await waitFor(() => expect(result.current.duration).toBe(DEFAULT_TOAST_DURATION))
    expect(result.current.visibleCount).toBe(DEFAULT_TOAST_VISIBLE_COUNT)
  })
})

describe('setDuration / setVisibleCount', () => {
  it('setDuration → settings.set + invalidate', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: null })
    vi.mocked(api().settings.set).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useToastSettings(), { wrapper })
    await act(async () => {
      await result.current.setDuration(10000)
    })
    expect(api().settings.set).toHaveBeenCalledWith('toast.duration', '10000')
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['toastSettings'] })
  })

  it('setDuration(Infinity) → "Infinity" 로 직렬화', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: null })
    vi.mocked(api().settings.set).mockResolvedValue({ success: true })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useToastSettings(), { wrapper })
    await act(async () => {
      await result.current.setDuration(Number.POSITIVE_INFINITY)
    })
    expect(api().settings.set).toHaveBeenCalledWith('toast.duration', 'Infinity')
  })

  it('setVisibleCount → settings.set', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: null })
    vi.mocked(api().settings.set).mockResolvedValue({ success: true })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useToastSettings(), { wrapper })
    await act(async () => {
      await result.current.setVisibleCount(10)
    })
    expect(api().settings.set).toHaveBeenCalledWith('toast.visibleCount', '10')
  })
})
