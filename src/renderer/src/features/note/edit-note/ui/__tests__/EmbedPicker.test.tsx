/**
 * features/note/edit-note/ui/EmbedPicker.test.tsx
 *
 * store.open + editorId 일치 → 표시. 불일치/close → null.
 * 데이터 4종 (notes/csvs/pdfs/images) 통합 표시.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

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

  it('query 입력 → 매칭 항목만 노출 (case-insensitive)', () => {
    mocks.open = true
    mocks.notes = [
      { id: 'n1', title: 'Apple Pie' },
      { id: 'n2', title: 'Banana Bread' }
    ]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'apple' } })
    expect(screen.getByText('Apple Pie')).toBeInTheDocument()
    expect(screen.queryByText('Banana Bread')).toBeNull()
  })

  it('query 공백 분리 토큰 → 모든 토큰 매칭만 노출', () => {
    mocks.open = true
    mocks.notes = [
      { id: 'n1', title: 'foo bar baz' },
      { id: 'n2', title: 'foo qux' }
    ]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'foo bar' } })
    expect(screen.getByText('foo bar baz')).toBeInTheDocument()
    expect(screen.queryByText('foo qux')).toBeNull()
  })

  it('4개 도메인 항목 모두 노출 (notes + csvs + pdfs + images)', () => {
    mocks.open = true
    mocks.notes = [{ id: 'n1', title: 'Note T' }]
    mocks.csvs = [{ id: 'c1', title: 'CSV T' }]
    mocks.pdfs = [{ id: 'p1', title: 'PDF T' }]
    mocks.images = [{ id: 'i1', title: 'Image T' }]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    expect(screen.getByText('Note T')).toBeInTheDocument()
    expect(screen.getByText('CSV T')).toBeInTheDocument()
    expect(screen.getByText('PDF T')).toBeInTheDocument()
    expect(screen.getByText('Image T')).toBeInTheDocument()
  })

  it('Escape 키 → closePicker 호출', () => {
    mocks.open = true
    mocks.notes = [{ id: 'n1', title: 'X' }]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(mocks.closePicker).toHaveBeenCalledTimes(1)
  })

  it('ArrowDown + Enter → editor 없음 → handleSelect early return (smoke)', () => {
    mocks.open = true
    mocks.notes = [{ id: 'n1', title: 'Pick Me' }]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    // editor null → closePicker 호출 안 됨 (handleSelect 안 됨)
    expect(mocks.closePicker).not.toHaveBeenCalled()
  })

  it('항목 클릭 → handleSelect (editor null) → 에러 없이 통과', () => {
    mocks.open = true
    mocks.notes = [{ id: 'n1', title: 'Click Me' }]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    fireEvent.click(screen.getByText('Click Me'))
    // editor 없음 → 안전하게 통과 (에러 throw 없음)
    expect(screen.getByText('Click Me')).toBeInTheDocument()
  })

  it('query 매칭 안 됨 → "결과 없음" 노출', () => {
    mocks.open = true
    mocks.notes = [{ id: 'n1', title: 'Apple' }]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzzz' } })
    expect(screen.getByText('결과 없음')).toBeInTheDocument()
  })

  it('ArrowUp 키 → focusIndex -1 막힘 (0 유지, smoke)', () => {
    mocks.open = true
    mocks.notes = [
      { id: 'n1', title: 'A' },
      { id: 'n2', title: 'B' }
    ]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    // 에러 없이 통과
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('mouseEnter → focusIndex 변경 (Check 아이콘 노출 검증은 smoke 클릭)', () => {
    mocks.open = true
    mocks.notes = [{ id: 'n1', title: 'Hover Item' }]
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    fireEvent.mouseEnter(screen.getByText('Hover Item'))
    // 에러 없이 통과
    expect(screen.getByText('Hover Item')).toBeInTheDocument()
  })

  it('항목 50개 초과 → 50개로 제한', () => {
    mocks.open = true
    mocks.notes = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      title: `Note ${i}`
    }))
    render(<EmbedPicker workspaceId="ws" editorId="ed-1" />)
    expect(screen.getByText('Note 0')).toBeInTheDocument()
    expect(screen.getByText('Note 49')).toBeInTheDocument()
    expect(screen.queryByText('Note 50')).toBeNull()
  })
})
