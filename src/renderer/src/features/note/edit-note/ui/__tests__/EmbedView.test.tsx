/**
 * features/note/edit-note/ui/EmbedView.test.tsx
 *
 * 4 domain 분기 (note/csv/pdf/image) smoke.
 * fallback: id 못찾으면 "삭제된 X" 노출.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  notes: [] as Array<{ id: string; title: string }>,
  csvs: [] as Array<{ id: string; title: string }>,
  pdfs: [] as Array<{ id: string; title: string }>,
  images: [] as Array<{ id: string; title: string }>,
  csvContent: '',
  pdfContent: new ArrayBuffer(0),
  imageContent: new ArrayBuffer(0)
}))

vi.mock('papaparse', () => ({
  default: { parse: () => ({ data: [['a', 'b']] }) }
}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ScrollBar: () => null
}))

vi.mock('@entities/note', () => ({
  useNotesByWorkspace: () => ({ data: mocks.notes })
}))

vi.mock('@entities/csv-file', () => ({
  useCsvFilesByWorkspace: () => ({ data: mocks.csvs }),
  useReadCsvContent: () => ({ data: mocks.csvContent })
}))

vi.mock('@entities/pdf-file', () => ({
  usePdfFilesByWorkspace: () => ({ data: mocks.pdfs }),
  useReadPdfContent: () => ({ data: mocks.pdfContent }),
  PdfViewer: () => <div data-testid="pdf-viewer" />
}))

vi.mock('@entities/image-file', () => ({
  useImageFilesByWorkspace: () => ({ data: mocks.images }),
  useReadImageContent: () => ({ data: mocks.imageContent })
}))

vi.mock('@/shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: () => 'ws-1'
}))

vi.mock('@shared/ui/icons/PdfIcon', () => ({
  PdfIcon: () => null
}))

vi.mock('@/entities/tab-system', () => ({
  useTabStore: { getState: () => ({ openTab: vi.fn() }) }
}))

import { EmbedView } from '../EmbedView'

beforeEach(() => {
  mocks.notes = []
  mocks.csvs = []
  mocks.pdfs = []
  mocks.images = []
})

describe('EmbedView', () => {
  it('note 매칭 → 제목 노출', () => {
    mocks.notes = [{ id: 'n1', title: 'My Note' }]
    render(<EmbedView domain="note" entityId="n1" />)
    expect(screen.getByText('My Note')).toBeInTheDocument()
  })

  it('note 미매칭 → "삭제된" 메시지', () => {
    render(<EmbedView domain="note" entityId="missing" />)
    expect(screen.getByText(/삭제된/)).toBeInTheDocument()
  })

  it('csv 매칭 → 제목 노출', () => {
    mocks.csvs = [{ id: 'c1', title: 'CSV File' }]
    render(<EmbedView domain="csv" entityId="c1" />)
    expect(screen.getByText('CSV File')).toBeInTheDocument()
  })

  it('pdf 매칭 → 제목 + PdfViewer (smoke)', () => {
    mocks.pdfs = [{ id: 'p1', title: 'PDF File' }]
    mocks.pdfContent = new ArrayBuffer(10)
    render(<EmbedView domain="pdf" entityId="p1" />)
    expect(screen.getByText('PDF File')).toBeInTheDocument()
  })

  it('image 매칭 → 제목 노출', () => {
    mocks.images = [{ id: 'i1', title: 'Image File' }]
    render(<EmbedView domain="image" entityId="i1" />)
    expect(screen.getByText('Image File')).toBeInTheDocument()
  })
})
