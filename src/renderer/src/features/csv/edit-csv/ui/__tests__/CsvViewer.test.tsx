/**
 * features/csv/edit-csv/ui/CsvViewer.test.tsx
 *
 * useCsvEditor 데이터 → CsvTable + CsvToolbar 마운트 smoke.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  editor: {
    data: [
      ['a', 'b'],
      ['1', '2']
    ],
    headers: ['col1', 'col2'],
    updateCell: vi.fn(),
    updateCells: vi.fn(),
    addRow: vi.fn(),
    addRowAt: vi.fn(),
    removeRow: vi.fn(),
    addColumn: vi.fn(),
    addColumnAt: vi.fn(),
    removeColumn: vi.fn(),
    renameColumn: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    isDirty: false,
    reset: vi.fn(),
    lastWrittenRef: { current: '' }
  }
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({})
}))

vi.mock('@entities/csv-file', () => ({
  useUpdateCsvMeta: () => ({ mutate: vi.fn() })
}))

vi.mock('../../model/use-csv-editor', () => ({
  useCsvEditor: () => mocks.editor
}))

vi.mock('../../model/use-csv-external-sync', () => ({
  useCsvExternalSync: vi.fn()
}))

vi.mock('../../model/use-csv-search', () => ({
  useCsvSearch: () => ({
    search: '',
    setSearch: vi.fn(),
    matches: [],
    activeMatchIndex: 0,
    goPrev: vi.fn(),
    goNext: vi.fn()
  })
}))

vi.mock('../CsvToolbar', () => ({
  CsvToolbar: () => <div data-testid="csv-toolbar" />
}))

vi.mock('../CsvTable', () => ({
  CsvTable: () => <div data-testid="csv-table" />
}))

import { CsvViewer } from '../CsvViewer'

describe('CsvViewer', () => {
  it('CsvToolbar + CsvTable 마운트', () => {
    render(
      <CsvViewer workspaceId="ws" csvId="c1" initialContent="a,b\n1,2" initialColumnWidths={null} />
    )
    expect(screen.getByTestId('csv-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('csv-table')).toBeInTheDocument()
  })

  it('initialColumnWidths JSON parse → 정상', () => {
    render(
      <CsvViewer
        workspaceId="ws"
        csvId="c1"
        initialContent="a,b"
        initialColumnWidths='{"col_0": 100}'
      />
    )
    expect(screen.getByTestId('csv-table')).toBeInTheDocument()
  })

  it('initialColumnWidths 잘못된 JSON → 빈 객체 fallback', () => {
    render(
      <CsvViewer workspaceId="ws" csvId="c1" initialContent="" initialColumnWidths="not json" />
    )
    expect(screen.getByTestId('csv-table')).toBeInTheDocument()
  })
})
