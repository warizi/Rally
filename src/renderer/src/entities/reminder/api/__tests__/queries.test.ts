/**
 * entities/reminder/api/queries.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useReminders, useSetReminder, useRemoveReminder } from '../queries'
import type { ReminderItem } from '../../model/types'

const REMINDER = { id: 'r-1' } as unknown as ReminderItem

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    reminder: { findByEntity: vi.fn(), set: vi.fn(), remove: vi.fn() }
  }
  vi.clearAllMocks()
})

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

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('useReminders', () => {
  it('성공 → 데이터 반환', async () => {
    vi.mocked(api().reminder.findByEntity).mockResolvedValue({ success: true, data: [] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useReminders('todo', 't-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().reminder.findByEntity).toHaveBeenCalledWith('todo', 't-1')
  })

  it('entityType / entityId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useReminders(null, 't-1'), { wrapper })
    renderHook(() => useReminders('todo', null), { wrapper })
    expect(api().reminder.findByEntity).not.toHaveBeenCalled()
  })
})

describe('useSetReminder / useRemoveReminder', () => {
  it('useSetReminder → entity 별 키 무효화', async () => {
    vi.mocked(api().reminder.set).mockResolvedValue({ success: true, data: REMINDER })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useSetReminder(), { wrapper })
    await act(async () => {
      result.current.mutate({ entityType: 'todo', entityId: 't-1', offsetMs: 1000 })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['reminder', 'todo', 't-1'] })
  })

  it('useRemoveReminder → entity 별 키 무효화', async () => {
    vi.mocked(api().reminder.remove).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveReminder(), { wrapper })
    await act(async () => {
      result.current.mutate({ reminderId: 'r-1', entityType: 'todo', entityId: 't-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['reminder', 'todo', 't-1'] })
  })
})
