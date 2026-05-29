/**
 * widgets/calendar/model/use-day-view-time-settings.test.ts
 *
 * settings IPC 로 startHour / endHour fetch + 기본값 fallback + invalidate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useDayViewTimeSettings } from '../use-day-view-time-settings'
import { DEFAULT_START_HOUR, DEFAULT_END_HOUR } from '../calendar-constants'

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

describe('useDayViewTimeSettings', () => {
  it('IPC 성공 → parseInt 결과 반환', async () => {
    vi.mocked(api().settings.get).mockImplementation(async (key) => {
      if (key === 'schedule.dayView.startHour') return { success: true, data: '9' }
      if (key === 'schedule.dayView.endHour') return { success: true, data: '18' }
      return { success: false, errorType: 'UnknownError', message: 'x' }
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useDayViewTimeSettings(), { wrapper })
    await waitFor(() => expect(result.current.settings.startHour).toBe(9))
    expect(result.current.settings.endHour).toBe(18)
  })

  it('IPC 실패 → DEFAULT_* 사용', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: 'no'
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useDayViewTimeSettings(), { wrapper })
    await waitFor(() => expect(result.current.settings.startHour).toBe(DEFAULT_START_HOUR))
    expect(result.current.settings.endHour).toBe(DEFAULT_END_HOUR)
  })

  it('data 없음 (data=null) → DEFAULT 사용', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: null })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useDayViewTimeSettings(), { wrapper })
    await waitFor(() => expect(result.current.settings.startHour).toBe(DEFAULT_START_HOUR))
  })

  it('updateStartHour → settings.set 호출 + invalidate', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: null })
    vi.mocked(api().settings.set).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDayViewTimeSettings(), { wrapper })
    await act(async () => {
      await result.current.updateStartHour(7)
    })
    expect(api().settings.set).toHaveBeenCalledWith('schedule.dayView.startHour', '7')
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['dayViewTime'] })
  })

  it('updateEndHour → settings.set 호출', async () => {
    vi.mocked(api().settings.get).mockResolvedValue({ success: true, data: null })
    vi.mocked(api().settings.set).mockResolvedValue({ success: true })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useDayViewTimeSettings(), { wrapper })
    await act(async () => {
      await result.current.updateEndHour(22)
    })
    expect(api().settings.set).toHaveBeenCalledWith('schedule.dayView.endHour', '22')
  })
})
