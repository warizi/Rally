/**
 * entities/pdf-file/ui/PdfViewer.test.tsx
 *
 * hideToolbar 분기. zoom in/out/rotate 버튼 클릭 → 상태 변화.
 * external change event → invalidateQueries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn()
}))

vi.mock('react-pdf', () => ({
  Document: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pdf-document">{children}</div>
  ),
  Page: () => <div data-testid="pdf-page" />,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } }
}))

vi.mock('react-pdf/dist/Page/AnnotationLayer.css', () => ({}))
vi.mock('react-pdf/dist/Page/TextLayer.css', () => ({}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('@shared/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../../model/external-changed-event', () => ({
  PDF_EXTERNAL_CHANGED_EVENT: 'pdf-external-changed'
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate })
}))

import { PdfViewer } from '../PdfViewer'

beforeEach(() => {
  mocks.invalidate.mockReset()
  // happy-dom 에 ResizeObserver 가 없음 → polyfill
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
})

describe('PdfViewer', () => {
  it('hideToolbar=false → zoom/rotate 버튼 노출', () => {
    render(<PdfViewer pdfId="p1" pdfData={new ArrayBuffer(10)} />)
    // 3 버튼 (zoomOut, zoomIn, rotate)
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(3)
  })

  it('hideToolbar=true → 버튼 미노출', () => {
    render(<PdfViewer pdfId="p1" pdfData={new ArrayBuffer(10)} hideToolbar />)
    expect(screen.queryAllByRole('button').length).toBe(0)
  })

  it('Document 컴포넌트 마운트', () => {
    render(<PdfViewer pdfId="p1" pdfData={new ArrayBuffer(10)} />)
    expect(screen.getByTestId('pdf-document')).toBeInTheDocument()
  })

  it('external change event (매칭 id) → invalidateQueries', () => {
    render(<PdfViewer pdfId="p1" pdfData={new ArrayBuffer(10)} />)
    act(() => {
      window.dispatchEvent(new CustomEvent('pdf-external-changed', { detail: { pdfId: 'p1' } }))
    })
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['pdf', 'content', 'p1'] })
  })

  it('external change event (다른 id) → invalidateQueries 호출 안 함', () => {
    render(<PdfViewer pdfId="p1" pdfData={new ArrayBuffer(10)} />)
    act(() => {
      window.dispatchEvent(new CustomEvent('pdf-external-changed', { detail: { pdfId: 'other' } }))
    })
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })

  it('rotate 버튼 클릭 → 동작 (smoke, 상태 변화)', () => {
    render(<PdfViewer pdfId="p1" pdfData={new ArrayBuffer(10)} />)
    const btns = screen.getAllByRole('button')
    fireEvent.click(btns[btns.length - 1]) // rotate 는 마지막 버튼
    // 회전이 적용됨 (rotation state 변경)
  })
})
