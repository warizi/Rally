/**
 * pages/pdf/ui/PdfPage.test.tsx
 *
 * CsvPage 와 동일 패턴.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  data: undefined as { data: ArrayBuffer } | undefined,
  isLoading: false,
  isError: false,
  setTabError: vi.fn()
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/pdf-file', () => ({
  useReadPdfContent: () => ({
    data: mocks.data,
    isLoading: mocks.isLoading,
    isError: mocks.isError
  })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { setTabError: typeof mocks.setTabError }) => unknown) =>
    sel({ setTabError: mocks.setTabError })
}))
vi.mock('@widgets/pdf-viewer', () => ({
  PdfHeader: ({ pdfId }: { pdfId: string }) => <div data-testid="pdf-header" data-pdf={pdfId} />,
  PdfViewer: ({ pdfId }: { pdfId: string }) => <div data-testid="pdf-viewer" data-pdf={pdfId} />
}))

import { PdfPage } from '../PdfPage'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.data = { data: new ArrayBuffer(8) }
  mocks.isLoading = false
  mocks.isError = false
  mocks.setTabError.mockClear()
})

describe('PdfPage', () => {
  it('pdfId 없음 → "PDF 정보가 없습니다"', () => {
    r(<PdfPage params={{}} />)
    expect(screen.getByText('PDF 정보가 없습니다.')).toBeInTheDocument()
  })

  it('isLoading=true → viewer 미렌더', () => {
    mocks.isLoading = true
    r(<PdfPage params={{ pdfId: 'p-1' }} />)
    expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument()
  })

  it('isError → 에러 메시지 + setTabError', () => {
    mocks.isError = true
    r(<PdfPage tabId="t-1" params={{ pdfId: 'p-1' }} />)
    expect(screen.getByText('PDF 불러오기를 실패하였습니다.')).toBeInTheDocument()
    expect(mocks.setTabError).toHaveBeenCalledWith('t-1', true)
  })

  it('성공 → PdfViewer 렌더 + pdfId 전달', () => {
    r(<PdfPage params={{ pdfId: 'p-1' }} />)
    expect(screen.getByTestId('pdf-viewer')).toHaveAttribute('data-pdf', 'p-1')
    expect(screen.getByTestId('pdf-header')).toHaveAttribute('data-pdf', 'p-1')
  })
})
