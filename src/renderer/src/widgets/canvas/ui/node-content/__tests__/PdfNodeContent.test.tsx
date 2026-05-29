/**
 * widgets/canvas/ui/node-content/PdfNodeContent.test.tsx
 *
 * isLoading / data 없음 / 성공 분기 + PdfViewer mount.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  data: undefined as { data: ArrayBuffer } | undefined,
  isLoading: false
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/pdf-file', () => ({
  useReadPdfContent: () => ({ data: mocks.data, isLoading: mocks.isLoading }),
  PdfViewer: ({ pdfId }: { pdfId: string }) => <div data-testid="pdf-viewer" data-pdf={pdfId} />
}))

import { PdfNodeContent } from '../PdfNodeContent'
import type { NodeContentProps } from '../../../model/node-content-registry'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.data = { data: new ArrayBuffer(8) }
  mocks.isLoading = false
})

describe('PdfNodeContent', () => {
  it('isLoading=true → 메시지', () => {
    mocks.isLoading = true
    render(<PdfNodeContent {...({ refId: 'p-1' } as unknown as NodeContentProps)} />)
    expect(screen.getByText('불러오는 중...')).toBeInTheDocument()
  })

  it('data 없음 → "PDF를 불러올 수 없습니다."', () => {
    mocks.data = undefined
    render(<PdfNodeContent {...({ refId: 'p-1' } as unknown as NodeContentProps)} />)
    expect(screen.getByText('PDF를 불러올 수 없습니다.')).toBeInTheDocument()
  })

  it('성공 → PdfViewer 렌더', () => {
    render(<PdfNodeContent {...({ refId: 'p-1' } as unknown as NodeContentProps)} />)
    expect(screen.getByTestId('pdf-viewer')).toHaveAttribute('data-pdf', 'p-1')
  })
})
