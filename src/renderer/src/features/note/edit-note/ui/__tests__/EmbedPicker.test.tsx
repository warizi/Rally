/**
 * features/note/edit-note/ui/EmbedPicker.test.tsx
 *
 * store.open + editorId 일치 → 표시. 불일치/close → null.
 * 데이터 4종 (notes/csvs/pdfs/images) 통합 표시.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  open: false,
  editorId: 'ed-1',
  position: { x: 0, y: 0 },
  range: { from: 0, to: 0 },
  closePicker: vi.fn(),
  notes: [] as Array<{ id: string; title: string }>,
  csvs: [] as Array<{ id: string; title: string }>,
  pdfs: [] as Array<{ id: string; title: string }>,
  images: [] as Array<{ id: string; title: string }>
}))

vi.mock('@milkdown/react', () => ({
  useInstance: () => [null, () => null]
}))

vi.mock('@milkdown/kit/core', () => ({
  editorViewCtx: Symbol('editorViewCtx')
}))

vi.mock('../../model/embed-picker-store', () => ({
  useEmbedPickerStore: (
    sel: (s: {
      open: boolean
      editorId: string
      position: { x: number; y: number }
      range: { from: number; to: number }
      closePicker: () => void
    }) => unknown
  ) =>
    sel({
      open: mocks.open,
      editorId: mocks.editorId,
      position: mocks.position,
      range: mocks.range,
      closePicker: mocks.closePicker
    })
}))

vi.mock('@entities/note', () => ({
  useNotesByWorkspace: () => ({ data: mocks.notes })
}))

vi.mock('@entities/csv-file', () => ({
  useCsvFilesByWorkspace: () => ({ data: mocks.csvs })
}))

vi.mock('@entities/pdf-file', () => ({
  usePdfFilesByWorkspace: () => ({ data: mocks.pdfs })
}))

vi.mock('@entities/image-file', () => ({
  useImageFilesByWorkspace: () => ({ data: mocks.images })
}))

vi.mock('@shared/ui/icons/PdfIcon', () => ({
  PdfIcon: () => null
}))

vi.mock('../../model/note-embed-schema', () => ({
  RALLY_EMBED_NODE_NAME: 'embed'
}))

import { EmbedPicker } from '../EmbedPicker'

beforeEach(() => {
  mocks.open = false
  mocks.editorId = 'ed-1'
  mocks.notes = []
  mocks.csvs = []
  mocks.pdfs = []
  mocks.images = []
  mocks.closePicker.mockReset()
})

describe('EmbedPicker', () => {
  it('open=false → null', () => {
    const { container } = render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    expect(container.firstChild).toBeNull()
  })

  it('open=true + editorId 불일치 → null', () => {
    mocks.open = true
    mocks.editorId = 'other-editor'
    const { container } = render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    expect(container.firstChild).toBeNull()
  })

  it('open=true + editorId 일치 → input 노출', () => {
    mocks.open = true
    mocks.editorId = 'ed-1'
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('notes + csvs 데이터 있음 → 항목 노출', () => {
    mocks.open = true
    mocks.notes = [{ id: 'n1', title: 'Note A' }]
    mocks.csvs = [{ id: 'c1', title: 'CSV B' }]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    expect(screen.getByText('Note A')).toBeInTheDocument()
    expect(screen.getByText('CSV B')).toBeInTheDocument()
  })

  it('데이터 없음 → 빈 상태 / 항목 없음', () => {
    mocks.open = true
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
