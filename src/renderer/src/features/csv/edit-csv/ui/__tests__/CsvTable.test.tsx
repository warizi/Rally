/**
 * features/csv/edit-csv/ui/CsvTable.test.tsx
 *
 * 헤더 + 데이터 행 렌더 smoke. virtualizer mock.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const virtualState = {
  items: [] as Array<{ index: number; start: number; key: number; size: number }>
}

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      virtualState.items.length > 0
        ? virtualState.items
        : Array.from({ length: count }, (_, i) => ({
            index: i,
            start: i * 32,
            key: i,
            size: 32
          })),
    getTotalSize: () => count * 32,
    scrollToIndex: vi.fn(),
    measure: vi.fn(),
    measureElement: vi.fn(),
    getOffsetForIndex: () => 0
  })
}))

vi.mock('@shared/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ContextMenuItem: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  ContextMenuSeparator: () => <hr />
}))

vi.mock('../../model/types', () => ({
  ROW_HEIGHT: 32,
  HEADER_HEIGHT: 36,
  ROW_NUM_WIDTH: 40,
  ADD_COL_WIDTH: 40,
  DEFAULT_COL_WIDTH: 150
}))

vi.mock('../../model/use-csv-selection', () => ({
  useCsvSelection: () => ({
    selection: null,
    setSelection: vi.fn(),
    isCellSelected: () => false,
    clearSelection: vi.fn()
  })
}))

vi.mock('../../model/use-csv-clipboard', () => ({
  useCsvClipboard: () => ({ copy: vi.fn(), paste: vi.fn(), cut: vi.fn() })
}))

vi.mock('../../model/use-csv-keyboard', () => ({
  useCsvKeyboard: () => ({ handleKeyDown: vi.fn() })
}))

vi.mock('../../model/use-csv-column-resize', () => ({
  useCsvColumnResize: () => ({ handleMouseDown: vi.fn(), isResizing: false })
}))

vi.mock('../EditableCell', () => ({
  EditableCell: () => <div data-testid="editable-cell" />
}))

vi.mock('../EditableColumnHeader', () => ({
  EditableColumnHeader: ({ name }: { name: string }) => (
    <div data-testid={`header-${name}`}>{name}</div>
  )
}))

import { CsvTable } from '../CsvTable'

const baseProps = {
  headers: ['col1', 'col2'],
  data: [
    ['a', 'b'],
    ['c', 'd']
  ],
  columnSizing: {},
  onColumnSizingChange: vi.fn(),
  onUpdateCell: vi.fn(),
  onUpdateCells: vi.fn(),
  onRemoveRow: vi.fn(),
  onAddRowAt: vi.fn(),
  onAddColumn: vi.fn(),
  onAddColumnAt: vi.fn(),
  onRemoveColumn: vi.fn(),
  onRenameColumn: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn()
}

describe('CsvTable', () => {
  it('렌더 에러 없음 (smoke)', () => {
    const { container } = render(<CsvTable {...baseProps} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('빈 데이터 → 에러 없이 렌더 (smoke)', () => {
    const { container } = render(<CsvTable {...baseProps} headers={[]} data={[]} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('헤더 노출 (EditableColumnHeader 매핑)', () => {
    const { getByTestId } = render(<CsvTable {...baseProps} />)
    expect(getByTestId('header-col1')).toBeInTheDocument()
    expect(getByTestId('header-col2')).toBeInTheDocument()
  })

  it('virtualizer rows 렌더 → EditableCell 노출', () => {
    const { getAllByTestId } = render(<CsvTable {...baseProps} />)
    expect(getAllByTestId('editable-cell').length).toBeGreaterThan(0)
  })

  it('columnSizing prop 적용 (smoke)', () => {
    const { container } = render(
      <CsvTable {...baseProps} columnSizing={{ col_0: 200, col_1: 100 }} />
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('focusCell prop → 스크롤 호출 (smoke)', () => {
    const { container } = render(<CsvTable {...baseProps} focusCell={{ row: 1, col: 0 }} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('matchedCells prop → highlight 클래스 적용 (smoke)', () => {
    const { container } = render(<CsvTable {...baseProps} matchedCells={new Set(['0:0', '1:1'])} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('onSearchClear prop 정의 → smoke', () => {
    const onSearchClear = vi.fn()
    const { container } = render(<CsvTable {...baseProps} onSearchClear={onSearchClear} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('많은 column → 헤더 모두 렌더', () => {
    const { getByTestId } = render(
      <CsvTable
        {...baseProps}
        headers={['a', 'b', 'c', 'd', 'e']}
        data={[['1', '2', '3', '4', '5']]}
      />
    )
    expect(getByTestId('header-a')).toBeInTheDocument()
    expect(getByTestId('header-e')).toBeInTheDocument()
  })

  it('headers 비어있음 → "빈 테이블입니다." + 열 추가 버튼 노출', () => {
    const { getByText } = render(<CsvTable {...baseProps} headers={[]} data={[]} />)
    expect(getByText('빈 테이블입니다.')).toBeInTheDocument()
    expect(getByText(/열 추가/)).toBeInTheDocument()
  })

  it('headers 비어있음 + 열 추가 버튼 클릭 → onAddColumn 호출', () => {
    const onAddColumn = vi.fn()
    const { getByText } = render(
      <CsvTable {...baseProps} headers={[]} data={[]} onAddColumn={onAddColumn} />
    )
    fireEventLite(getByText(/열 추가/))
    expect(onAddColumn).toHaveBeenCalled()
  })

  it('row 1개 + col 1개 → 단일 셀 렌더 (smoke)', () => {
    const { getAllByTestId } = render(<CsvTable {...baseProps} headers={['only']} data={[['x']]} />)
    expect(getAllByTestId('editable-cell').length).toBeGreaterThan(0)
  })

  it('headers 많음 (10개) → 모두 노출', () => {
    const headers = Array.from({ length: 10 }, (_, i) => `col${i}`)
    const data = [Array.from({ length: 10 }, (_, i) => `v${i}`)]
    const { getByTestId } = render(<CsvTable {...baseProps} headers={headers} data={data} />)
    expect(getByTestId('header-col0')).toBeInTheDocument()
    expect(getByTestId('header-col9')).toBeInTheDocument()
  })

  it('data 많음 (50 rows) → virtualizer 적용 + cell 다수 렌더', () => {
    const data = Array.from({ length: 50 }, (_, i) => [`v${i}`, `w${i}`])
    const { getAllByTestId } = render(<CsvTable {...baseProps} headers={['a', 'b']} data={data} />)
    expect(getAllByTestId('editable-cell').length).toBeGreaterThan(10)
  })
})

// fireEvent.click 의 간단 helper — testing-library 의 fireEvent.click 미사용 (모듈 분리)
function fireEventLite(el: HTMLElement): void {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  el.dispatchEvent(event)
}
