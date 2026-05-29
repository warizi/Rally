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
  useDuplicateCsvFile,
  useRenameCsvFile,
  useRemoveCsvFile,
  useMoveCsvFile,
  useUpdateCsvMeta,
  useToggleCsvLock,
  useReadCsvContent,
  useWriteCsvContent
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

  it('useRenameCsvFile → csv + history 둘 다 무효화', async () => {
    vi.mocked(api().csv.rename).mockResolvedValue({ success: true, data: CSV })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRenameCsvFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', csvId: 'csv-1', newName: 'newname.csv' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['csv', 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history', 'ws-1'] })
  })

  it('useRemoveCsvFile → csv + history 둘 다 무효화', async () => {
    vi.mocked(api().csv.remove).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRemoveCsvFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', csvId: 'csv-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['csv', 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history', 'ws-1'] })
  })

  it('useMoveCsvFile → 4종 leaf type list 모두 무효화', async () => {
    vi.mocked(api().csv.move).mockResolvedValue({ success: true, data: CSV })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useMoveCsvFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', csvId: 'csv-1', folderId: 'f-1', index: 0 })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    for (const key of ['note', 'csv', 'pdf', 'image']) {
      expect(invSpy).toHaveBeenCalledWith({ queryKey: [key, 'workspace', 'ws-1'] })
    }
  })

  it('useUpdateCsvMeta (description만) → list/history 무효화, content cache 미변경', async () => {
    vi.mocked(api().csv.updateMeta).mockResolvedValue({ success: true, data: CSV })
    const { wrapper, qc } = makeWrapper()
    const setSpy = vi.spyOn(qc, 'setQueryData')
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateCsvMeta(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', csvId: 'csv-1', data: { description: 'd' } })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['csv', 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history', 'ws-1'] })
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('useUpdateCsvMeta (columnWidths) → content cache 갱신', async () => {
    vi.mocked(api().csv.updateMeta).mockResolvedValue({ success: true, data: CSV })
    const { wrapper, qc } = makeWrapper()
    qc.setQueryData(['csv', 'content', 'csv-1'], {
      content: 'a,b,c',
      encoding: 'UTF-8',
      columnWidths: null
    })
    const { result } = renderHook(() => useUpdateCsvMeta(), { wrapper })
    await act(async () => {
      result.current.mutate({
        workspaceId: 'ws-1',
        csvId: 'csv-1',
        data: { columnWidths: '[100,200]' }
      })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const cached = qc.getQueryData(['csv', 'content', 'csv-1']) as
      | { content: string; encoding: string; columnWidths: string | null }
      | undefined
    expect(cached?.columnWidths).toBe('[100,200]')
  })

  it('useToggleCsvLock → 성공 시 list 무효화', async () => {
    vi.mocked(api().csv.toggleLock).mockResolvedValue({ success: true, data: CSV })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useToggleCsvLock(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', csvId: 'csv-1', isLocked: true })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['csv', 'workspace', 'ws-1'] })
  })

  it('useReadCsvContent → 성공', async () => {
    vi.mocked(api().csv.readContent).mockResolvedValue({
      success: true,
      data: { content: 'a,b', encoding: 'UTF-8', columnWidths: null }
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useReadCsvContent('ws-1', 'csv-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.content).toBe('a,b')
  })

  it('useReadCsvContent → csvId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useReadCsvContent('ws-1', ''), { wrapper })
    expect(api().csv.readContent).not.toHaveBeenCalled()
  })

  it('useWriteCsvContent → content cache 즉시 갱신', async () => {
    vi.mocked(api().csv.writeContent).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    qc.setQueryData(['csv', 'content', 'csv-1'], {
      content: 'old',
      encoding: 'EUC-KR',
      columnWidths: '[]'
    })
    const { result } = renderHook(() => useWriteCsvContent(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', csvId: 'csv-1', content: 'new' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const cached = qc.getQueryData(['csv', 'content', 'csv-1']) as {
      content: string
      encoding: string
      columnWidths: string | null
    }
    expect(cached).toEqual({ content: 'new', encoding: 'EUC-KR', columnWidths: '[]' })
  })
})
