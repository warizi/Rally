/**
 * entities/pdf-file/api/queries.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode, type ReactElement } from 'react'
import {
  usePdfFilesByWorkspace,
  useImportPdfFile,
  useDuplicatePdfFile,
  useRenamePdfFile,
  useRemovePdfFile,
  useMovePdfFile,
  useUpdatePdfMeta,
  useReadPdfContent
} from '../queries'
import type { PdfFileNode } from '../../model/types'

const PDF = { id: 'pdf-1' } as unknown as PdfFileNode

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).api = {
    pdf: {
      readByWorkspace: vi.fn(),
      import: vi.fn(),
      duplicate: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
      updateMeta: vi.fn(),
      readContent: vi.fn()
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

describe('pdf-file queries', () => {
  it('usePdfFilesByWorkspace → 성공', async () => {
    vi.mocked(api().pdf.readByWorkspace).mockResolvedValue({ success: true, data: [PDF] })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => usePdfFilesByWorkspace('ws-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([PDF])
  })

  it('usePdfFilesByWorkspace → 빈 workspaceId 시 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => usePdfFilesByWorkspace(''), { wrapper })
    expect(api().pdf.readByWorkspace).not.toHaveBeenCalled()
  })

  it('useImportPdfFile → 무효화', async () => {
    vi.mocked(api().pdf.import).mockResolvedValue({ success: true, data: PDF })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useImportPdfFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', folderId: null, sourcePath: '/x.pdf' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['pdf', 'workspace', 'ws-1'] })
  })

  it('useDuplicatePdfFile → 무효화', async () => {
    vi.mocked(api().pdf.duplicate).mockResolvedValue({ success: true, data: PDF })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useDuplicatePdfFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', pdfId: 'pdf-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['pdf', 'workspace', 'ws-1'] })
  })

  it('useRenamePdfFile → pdf + history 둘 다 무효화', async () => {
    vi.mocked(api().pdf.rename).mockResolvedValue({ success: true, data: PDF })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRenamePdfFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', pdfId: 'pdf-1', newName: 'new.pdf' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['pdf', 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history', 'ws-1'] })
  })

  it('useRemovePdfFile → pdf + history 둘 다 무효화', async () => {
    vi.mocked(api().pdf.remove).mockResolvedValue({ success: true })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useRemovePdfFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', pdfId: 'pdf-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['pdf', 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history', 'ws-1'] })
  })

  it('useMovePdfFile → 4종 leaf type 모두 무효화', async () => {
    vi.mocked(api().pdf.move).mockResolvedValue({ success: true, data: PDF })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useMovePdfFile(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', pdfId: 'pdf-1', folderId: null, index: 1 })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    for (const key of ['note', 'csv', 'pdf', 'image']) {
      expect(invSpy).toHaveBeenCalledWith({ queryKey: [key, 'workspace', 'ws-1'] })
    }
  })

  it('useUpdatePdfMeta → 무효화', async () => {
    vi.mocked(api().pdf.updateMeta).mockResolvedValue({ success: true, data: PDF })
    const { wrapper, qc } = makeWrapper()
    const invSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useUpdatePdfMeta(), { wrapper })
    await act(async () => {
      result.current.mutate({ workspaceId: 'ws-1', pdfId: 'pdf-1', data: { description: 'd' } })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['pdf', 'workspace', 'ws-1'] })
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ['history', 'ws-1'] })
  })

  it('useReadPdfContent → 성공', async () => {
    const buf = new ArrayBuffer(8)
    vi.mocked(api().pdf.readContent).mockResolvedValue({ success: true, data: { data: buf } })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useReadPdfContent('ws-1', 'pdf-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.data).toBe(buf)
  })

  it('useReadPdfContent → pdfId 없으면 disabled', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useReadPdfContent('ws-1', ''), { wrapper })
    expect(api().pdf.readContent).not.toHaveBeenCalled()
  })
})
