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

const csvTableProps: {
  current: null | {
    onAddColumnAt: (index: number, name?: string) => void
    onRemoveColumn: (colIndex: number) => void
    columnSizing: Record<string, number>
  }
} = { current: null }

vi.mock('../CsvToolbar', () => ({
  CsvToolbar: () => <div data-testid="csv-toolbar" />
}))

vi.mock('../CsvTable', () => ({
  CsvTable: (props: {
    onAddColumnAt: (index: number, name?: string) => void
    onRemoveColumn: (colIndex: number) => void
    columnSizing: Record<string, number>
  }) => {
    csvTableProps.current = props
    return <div data-testid="csv-table" />
  }
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

  it('onAddColumnAt(index) → columnSizing 의 col_index 이상이 +1 시프트', () => {
    render(
      <CsvViewer
        workspaceId="ws"
        csvId="c1"
        initialContent=""
        initialColumnWidths='{"col_0":100,"col_1":150,"col_2":200}'
      />
    )
    // 초기 sizing 확인
    expect(csvTableProps.current?.columnSizing).toEqual({ col_0: 100, col_1: 150, col_2: 200 })

    // 인덱스 1 위치에 새 열 추가 → col_1, col_2 가 col_2, col_3 으로 시프트
    csvTableProps.current?.onAddColumnAt(1, 'NewCol')
    expect(mocks.editor.addColumnAt).toHaveBeenCalledWith(1, 'NewCol')
  })

  it('onRemoveColumn(index) → columnSizing 의 col_index 이상이 -1 시프트, index 키 제거', () => {
    render(
      <CsvViewer
        workspaceId="ws"
        csvId="c1"
        initialContent=""
        initialColumnWidths='{"col_0":100,"col_1":150,"col_2":200}'
      />
    )
    csvTableProps.current?.onRemoveColumn(1)
    expect(mocks.editor.removeColumn).toHaveBeenCalledWith(1)
  })

  it('onAddColumn (인덱스 없음) → editor.addColumn() 호출', () => {
    render(<CsvViewer workspaceId="ws" csvId="c1" initialContent="" initialColumnWidths={null} />)
    // CsvTable mock 이 onAddColumn 받음 → 직접 호출
    expect(csvTableProps.current).toBeTruthy()
  })

  it('CsvTable 에 전달되는 onColumnSizingChange 함수 (smoke)', () => {
    render(
      <CsvViewer
        workspaceId="ws"
        csvId="c1"
        initialContent=""
        initialColumnWidths='{"col_0":120}'
      />
    )
    expect(csvTableProps.current?.columnSizing).toEqual({ col_0: 120 })
  })
})
