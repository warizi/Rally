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
  useDuplicatePdfFile
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

function makeWrapper(): { wrapper: ({ children }: { children: ReactNode }) => ReactElement; qc: QueryClient } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
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
})
