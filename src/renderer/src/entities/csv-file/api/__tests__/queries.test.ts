/**
 * entities/csv-file/api/queries.test.ts — 핵심 hook spot-check.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import {
  useCsvFilesByWorkspace,
  useCreateCsvFile,
  useImportCsvFile,
  useDuplicateCsvFile
} from '../queries'
import type { CsvFileNode } from '../../model/types'

const CSV = { id: 'csv-1' } as unknown as CsvFileNode

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    csv: {
      readByWorkspace: vi.fn(),
      create: vi.fn(),
      import: vi.fn(),
      duplicate: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
      updateMeta: vi.fn(),
      toggleLock: vi.fn(),
      readContent: vi.fn(),
      writeContent: vi.fn()
    }
  }
  vi.clearAllMocks()
})

function makeWrapper(): { wrapper: ({ children }: { children: ReactNode }) => ReactElement; qc: QueryClient } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client: qc }, children)
  }
}

const api = (): typeof window.api => (window as unknown as { api: typeof window.api }).api

describe('csv-file queries', () => {
  it('useCsvFilesByWorkspace → 성공', async () => {
    vi.mocked(api().csv.readByWorkspace).mockResolvedValue({ success: true, data: [CSV] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCsvFilesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([CSV])
  })

  it('useCsvFilesByWorkspace → workspaceId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useCsvFilesByWorkspace(''), { wrapper })
    expect(api().csv.readByWorkspace).not.toHaveBeenCalled()
  })

  it('useCreateCsvFile → 무효화', async () => {
    vi.mocked(api().csv.create).mockResolvedValue({ success: true, data: CSV })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useCreateCsvFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', folderId: null, name: 'x' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['csv', 'workspace', 'ws-1'] })
  })

  it('useImportCsvFile → 무효화', async () => {
    vi.mocked(api().csv.import).mockResolvedValue({ success: true, data: CSV })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useImportCsvFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', folderId: null, sourcePath: '/x.csv' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['csv', 'workspace', 'ws-1'] })
  })

  it('useDuplicateCsvFile → 무효화', async () => {
    vi.mocked(api().csv.duplicate).mockResolvedValue({ success: true, data: CSV })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDuplicateCsvFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', csvId: 'csv-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['csv', 'workspace', 'ws-1'] })
  })
})
