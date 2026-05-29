/**
 * entities/template/api/queries.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import { useTemplates, useCreateTemplate, useDeleteTemplate } from '../queries'
import type { Template } from '../../model/types'

const TEMPLATE = { id: 't-1' } as unknown as Template

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    template: { list: vi.fn(), create: vi.fn(), delete: vi.fn() }
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

describe('useTemplates', () => {
  it('성공 → 결과 반환', async () => {
    vi.mocked(api().template.list).mockResolvedValue({ success: true, data: [] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTemplates('ws-1', 'note'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api().template.list).toHaveBeenCalledWith('ws-1', 'note')
  })

  it('workspaceId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useTemplates('', 'note'), { wrapper })
    expect(api().template.list).not.toHaveBeenCalled()
  })
})

describe('useCreateTemplate / useDeleteTemplate', () => {
  it('useCreateTemplate → list/workspaceId/type 키 무효화', async () => {
    vi.mocked(api().template.create).mockResolvedValue({ success: true, data: TEMPLATE })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCreateTemplate(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', title: 'x', type: 'note', jsonData: '{}' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['template', 'list', 'ws-1', 'note'] })
  })

  it('useDeleteTemplate → 동일 키 무효화', async () => {
    vi.mocked(api().template.delete).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteTemplate(), { wrapper })
    await act(async () => {
      result.current.mutate({ id: 't-1', workspaceId: 'ws-1', type: 'csv' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['template', 'list', 'ws-1', 'csv'] })
  })
})
