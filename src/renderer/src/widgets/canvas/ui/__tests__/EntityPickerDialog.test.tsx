/**
 * widgets/canvas/ui/EntityPickerDialog.test.tsx
 *
 * open + workspaceId 없으면 콘텐츠 미렌더. 정상이면 type tabs + 검색 input.
 * type 클릭 → 선택. 항목 클릭 → onSelect(type, id) + close.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  todos: [] as Array<{ id: string; title: string }>,
  notes: [] as Array<{ id: string; title: string; preview?: string }>,
  schedules: [] as Array<{ id: string; title: string }>,
  csvFiles: [] as Array<{ id: string; title: string }>,
  pdfFiles: [] as Array<{ id: string; title: string }>,
  imageFiles: [] as Array<{ id: string; title: string }>,
  canvases: [] as Array<{ id: string; title: string }>
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))

vi.mock('@entities/todo', () => ({ useTodosByWorkspace: () => ({ data: mocks.todos }) }))
vi.mock('@entities/note', () => ({ useNotesByWorkspace: () => ({ data: mocks.notes }) }))
vi.mock('@entities/schedule', () => ({
  useAllSchedulesByWorkspace: () => ({ data: mocks.schedules })
}))
vi.mock('@entities/csv-file', () => ({
  useCsvFilesByWorkspace: () => ({ data: mocks.csvFiles })
}))
vi.mock('@entities/pdf-file', () => ({
  usePdfFilesByWorkspace: () => ({ data: mocks.pdfFiles })
}))
vi.mock('@entities/image-file', () => ({
  useImageFilesByWorkspace: () => ({ data: mocks.imageFiles })
}))
vi.mock('@entities/canvas', () => ({
  useCanvasesByWorkspace: () => ({ data: mocks.canvases })
}))

vi.mock('../../model/node-type-registry', () => {
  const Icon = (): React.JSX.Element => <span />
  return {
    PICKABLE_TYPES: [
      { type: 'todo', label: '할일', icon: Icon },
      { type: 'note', label: '노트', icon: Icon },
      { type: 'schedule', label: '일정', icon: Icon },
      { type: 'csv', label: '테이블', icon: Icon },
      { type: 'pdf', label: 'PDF', icon: Icon },
      { type: 'image', label: '이미지', icon: Icon },
      { type: 'canvas', label: '캔버스', icon: Icon }
    ]
  }
})

import { EntityPickerDialog } from '../EntityPickerDialog'

const base = {
  open: true,
  onOpenChange: vi.fn(),
  onSelect: vi.fn(),
  canvasId: 'c1'
}

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.todos = []
  mocks.notes = []
  mocks.schedules = []
  mocks.csvFiles = []
  mocks.pdfFiles = []
  mocks.imageFiles = []
  mocks.canvases = []
})

describe('EntityPickerDialog', () => {
  it('open=false → 콘텐츠 미렌더', () => {
    render(<EntityPickerDialog {...base} open={false} />)
    expect(screen.queryByPlaceholderText(/검색/)).not.toBeInTheDocument()
  })

  it('workspaceId=null → 콘텐츠 미렌더', () => {
    mocks.workspaceId = null
    render(<EntityPickerDialog {...base} />)
    expect(screen.queryByPlaceholderText(/검색/)).not.toBeInTheDocument()
  })

  it('open + workspaceId 있음 → 타이틀 + 검색 input + type 버튼 노출', () => {
    render(<EntityPickerDialog {...base} />)
    expect(screen.getByText('요소 추가')).toBeInTheDocument()
    expect(screen.getByText('할일')).toBeInTheDocument()
    expect(screen.getByText('노트')).toBeInTheDocument()
  })

  it('todos 있음 (selectedType=todo 기본) → todo 목록 노출 + 클릭 → onSelect', () => {
    mocks.todos = [{ id: 't1', title: 'Todo A' }]
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()
    render(<EntityPickerDialog {...base} onSelect={onSelect} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByText('Todo A'))
    expect(onSelect).toHaveBeenCalledWith('todo', 't1')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('type tab 클릭 → 다른 type 목록 노출', () => {
    mocks.notes = [{ id: 'n1', title: 'Note B' }]
    render(<EntityPickerDialog {...base} />)
    fireEvent.click(screen.getByText('노트'))
    expect(screen.getByText('Note B')).toBeInTheDocument()
  })
})
