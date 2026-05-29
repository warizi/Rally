/**
 * entities/schedule/api/queries.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import {
  useAllSchedulesByWorkspace,
  useSchedulesByWorkspace,
  useScheduleById,
  useCreateSchedule,
  useUpdateSchedule,
  useRemoveSchedule,
  useMoveSchedule
} from '../queries'
import type { ScheduleItem } from '../../model/types'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    schedule: {
      findAllByWorkspace: vi.fn(),
      findByWorkspace: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
      linkTodo: vi.fn(),
      unlinkTodo: vi.fn(),
      getLinkedTodos: vi.fn()
    }
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

describe('schedule queries', () => {
  it('useAllSchedulesByWorkspace → 성공', async () => {
    vi.mocked(api().schedule.findAllByWorkspace).mockResolvedValue({ success: true, data: [] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useAllSchedulesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().schedule.findAllByWorkspace).toHaveBeenCalledWith('ws-1')
  })

  it('useAllSchedulesByWorkspace → null workspaceId 시 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useAllSchedulesByWorkspace(null), { wrapper })
    expect(api().schedule.findAllByWorkspace).not.toHaveBeenCalled()
  })

  it('useSchedulesByWorkspace → range 전달 + queryKey 에 ISO 포함', async () => {
    vi.mocked(api().schedule.findByWorkspace).mockResolvedValue({ success: true, data: [] })
    const range = {
      start: new Date('2026-05-01'),
      end: new Date('2026-05-31')
    }
    const { wrapper } = makeWrapper()
    renderHook(() => useSchedulesByWorkspace('ws-1', range), { wrapper })
    await waitFor(() => expect(api().schedule.findByWorkspace).toHaveBeenCalledWith('ws-1', range))
  })

  it('useScheduleById → scheduleId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useScheduleById(undefined), { wrapper })
    expect(api().schedule.findById).not.toHaveBeenCalled()
  })

  it('useScheduleById → 성공', async () => {
    const sch = { id: 'sch-1' } as unknown as ScheduleItem
    vi.mocked(api().schedule.findById).mockResolvedValue({ success: true, data: sch })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useScheduleById('sch-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(sch)
  })
})

describe('schedule mutations', () => {
  const SCH = { id: 'sch-1' } as unknown as ScheduleItem

  it('useCreateSchedule → workspace key 무효화', async () => {
    vi.mocked(api().schedule.create).mockResolvedValue({ success: true, data: SCH })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useCreateSchedule(), { wrapper })
    await act(async () => {
      result.current.mutate({
        workspaceId: 'ws-1',
        data: { title: 'x', startAt: new Date(), endAt: new Date(), allDay: false } as never
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(inv).toHaveBeenCalledWith({ queryKey: ['schedule', 'workspace', 'ws-1'] })
  })

  it('useUpdateSchedule → 무효화', async () => {
    vi.mocked(api().schedule.update).mockResolvedValue({ success: true, data: SCH })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateSchedule(), { wrapper })
    await act(async () => {
      result.current.mutate({
        scheduleId: 'sch-1',
        data: { title: 'y' } as never,
        workspaceId: 'ws-1'
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(inv).toHaveBeenCalledWith({ queryKey: ['schedule', 'workspace', 'ws-1'] })
  })

  it('useRemoveSchedule → 무효화', async () => {
    vi.mocked(api().schedule.remove).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRemoveSchedule(), { wrapper })
    await act(async () => {
      result.current.mutate({ scheduleId: 'sch-1', workspaceId: 'ws-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(inv).toHaveBeenCalledWith({ queryKey: ['schedule', 'workspace', 'ws-1'] })
  })

  it('useMoveSchedule → startAt/endAt 전달 + 무효화', async () => {
    vi.mocked(api().schedule.move).mockResolvedValue({ success: true, data: SCH })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useMoveSchedule(), { wrapper })
    const startAt = new Date('2026-06-01')
    const endAt = new Date('2026-06-02')
    await act(async () => {
      result.current.mutate({ scheduleId: 'sch-1', startAt, endAt, workspaceId: 'ws-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().schedule.move).toHaveBeenCalledWith('sch-1', startAt, endAt)
    expect(inv).toHaveBeenCalledWith({ queryKey: ['schedule', 'workspace', 'ws-1'] })
  })
})
