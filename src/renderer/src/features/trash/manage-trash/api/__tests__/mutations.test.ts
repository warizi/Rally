/**
 * features/trash/manage-trash/api/mutations.test.ts
 *
 * Trash 액션 4종 — restore/purge/emptyAll/setRetention.
 * 각 hook 의 onSuccess 가 trash + skill list 무효화를 함께 수행하는지 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useRestoreTrash, usePurgeTrash, useEmptyTrash, useSetTrashRetention } from '../mutations'
import type { TrashRetentionKey } from '@entities/trash'

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    trash: {
      restore: vi.fn(),
      purge: vi.fn(),
      emptyAll: vi.fn(),
      setRetention: vi.fn()
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

describe('useRestoreTrash', () => {
  it('성공 시 trash + skill 무효화', async () => {
    vi.mocked(api().trash.restore).mockResolvedValue({ success: true, data: undefined })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRestoreTrash(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', batchId: 'b-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(inv).toHaveBeenCalledWith({ queryKey: ['trash'] })
    expect(inv).toHaveBeenCalledWith({ queryKey: ['skill'] })
    expect(api().trash.restore).toHaveBeenCalledWith('ws-1', 'b-1')
  })

  it('IPC 실패 → isError', async () => {
    vi.mocked(api().trash.restore).mockResolvedValue({
      success: false,
      errorType: 'UnknownError',
      message: 'no'
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useRestoreTrash(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', batchId: 'b-1' })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('usePurgeTrash', () => {
  it('성공 시 trash + skill 무효화', async () => {
    vi.mocked(api().trash.purge).mockResolvedValue({ success: true, data: undefined })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => usePurgeTrash(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', batchId: 'b-2' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(inv).toHaveBeenCalledWith({ queryKey: ['trash'] })
    expect(inv).toHaveBeenCalledWith({ queryKey: ['skill'] })
  })
})

describe('useEmptyTrash', () => {
  it('성공 시 trash + skill 무효화', async () => {
    vi.mocked(api().trash.emptyAll).mockResolvedValue({ success: true, data: undefined })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useEmptyTrash(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(inv).toHaveBeenCalledWith({ queryKey: ['trash'] })
    expect(inv).toHaveBeenCalledWith({ queryKey: ['skill'] })
  })
})

describe('useSetTrashRetention', () => {
  it('성공 시 trash/retention 만 무효화 (skill 건드리지 않음)', async () => {
    vi.mocked(api().trash.setRetention).mockResolvedValue({ success: true, data: undefined })
    const { wrapper, qc } = makeWrapper()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useSetTrashRetention(), { wrapper })
    await act(async () => {
      result.current.mutate('30d' as TrashRetentionKey)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(inv).toHaveBeenCalledWith({ queryKey: ['trash', 'retention'] })
    // skill 무효화는 호출되지 않아야 함
    expect(inv).not.toHaveBeenCalledWith({ queryKey: ['skill'] })
  })
})
