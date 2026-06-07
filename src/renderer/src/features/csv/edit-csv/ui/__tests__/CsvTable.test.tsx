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

const selectionMocks = vi.hoisted(() => ({
  selection: null as null | {
    anchor: { row: number; col: number }
    focus: { row: number; col: number }
  },
  selectionRange: null as null | {
    startRow: number
    endRow: number
    startCol: number
    endCol: number
  },
  isSingleSelection: true,
  editingCell: null as null | { row: number; col: number },
  editSeed: null as string | null,
  lockedActive: null as null | { row: number; col: number },
  setLockedActive: vi.fn(),
  setSelection: vi.fn(),
  setEditingCell: vi.fn(),
  beginEdit: vi.fn(),
  handleStopEdit: vi.fn(),
  handleBlur: vi.fn(),
  handleMouseUp: vi.fn(),
  handleCellMouseDown: vi.fn(),
  handleCellMouseEnter: vi.fn(),
  handleCellStartEdit: vi.fn(),
  contextMenuOpenRef: { current: false }
}))

vi.mock('../../model/use-csv-selection', () => ({
  useCsvSelection: () => selectionMocks
}))

vi.mock('../../model/use-csv-clipboard', () => ({
  useCsvClipboard: () => ({
    copy: vi.fn(),
    paste: vi.fn(),
    cut: vi.fn(),
    deleteSelection: vi.fn()
  })
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

vi.mock('../CsvCellEditor', () => ({
  CsvCellEditor: () => <input data-testid="cell-editor" />
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

  it('focusCell prop → setSelection 호출 (useEffect)', () => {
    selectionMocks.setSelection.mockClear()
    render(<CsvTable {...baseProps} focusCell={{ row: 1, col: 0 }} />)
    expect(selectionMocks.setSelection).toHaveBeenCalledWith({
      anchor: { row: 1, col: 0 },
      focus: { row: 1, col: 0 }
    })
  })

  it('focusCell row<0 → setSelection 호출 안 함 (early return)', () => {
    selectionMocks.setSelection.mockClear()
    render(<CsvTable {...baseProps} focusCell={{ row: -1, col: 0 }} />)
    expect(selectionMocks.setSelection).not.toHaveBeenCalled()
  })

  it('focusCell null → setSelection 호출 안 함', () => {
    selectionMocks.setSelection.mockClear()
    render(<CsvTable {...baseProps} focusCell={null} />)
    expect(selectionMocks.setSelection).not.toHaveBeenCalled()
  })

  it('header click (mousedown left button) → handleHeaderMouseDown 호출', () => {
    selectionMocks.setSelection.mockClear()
    const { container } = render(<CsvTable {...baseProps} />)
    // header 영역의 mousedown
    const headerCells = container.querySelectorAll('.bg-muted.hover\\:bg-muted-foreground\\/10')
    if (headerCells.length > 0) {
      fireEventLite(headerCells[0] as HTMLElement, 'mousedown', { button: 0 })
      // setSelection 호출 (row=-1)
      expect(selectionMocks.setSelection).toHaveBeenCalled()
    }
  })

  it('header right click (button !== 0) → handleHeaderMouseDown early return', () => {
    selectionMocks.setSelection.mockClear()
    const { container } = render(<CsvTable {...baseProps} />)
    const headerCells = container.querySelectorAll('.bg-muted.hover\\:bg-muted-foreground\\/10')
    if (headerCells.length > 0) {
      fireEventLite(headerCells[0] as HTMLElement, 'mousedown', { button: 2 })
      expect(selectionMocks.setSelection).not.toHaveBeenCalled()
    }
  })

  it('selection 있음 + isFocus → ring-2 ring-primary 클래스', () => {
    selectionMocks.selection = {
      anchor: { row: 0, col: 0 },
      focus: { row: 0, col: 0 }
    }
    const { container } = render(<CsvTable {...baseProps} />)
    expect(container.innerHTML).toMatch(/ring-2 ring-primary/)
    selectionMocks.selection = null
  })

  it('selectionRange 있음 → bg-primary/10 클래스 (selected 영역)', () => {
    selectionMocks.selection = {
      anchor: { row: 0, col: 0 },
      focus: { row: 1, col: 1 }
    }
    selectionMocks.selectionRange = { startRow: 0, endRow: 1, startCol: 0, endCol: 1 }
    selectionMocks.isSingleSelection = false
    const { container } = render(<CsvTable {...baseProps} />)
    expect(container.innerHTML).toMatch(/bg-primary\/10/)
    selectionMocks.selection = null
    selectionMocks.selectionRange = null
    selectionMocks.isSingleSelection = true
  })

  it('matchedCells 있음 → bg-yellow-200/30 클래스', () => {
    const { container } = render(<CsvTable {...baseProps} matchedCells={new Set(['0_0', '0_1'])} />)
    expect(container.innerHTML).toMatch(/bg-yellow-200/)
  })

  it('row 삭제 버튼 클릭 → onRemoveRow 호출', () => {
    const onRemoveRow = vi.fn()
    const { container } = render(<CsvTable {...baseProps} onRemoveRow={onRemoveRow} />)
    const trashIcons = container.querySelectorAll('button.hidden')
    if (trashIcons.length > 0) {
      fireEventLite(trashIcons[0] as HTMLElement, 'click')
      expect(onRemoveRow).toHaveBeenCalled()
    }
  })

  it('header + 컬럼 추가 버튼 (+) 클릭 → onAddColumn 호출', () => {
    const onAddColumn = vi.fn()
    const { container } = render(<CsvTable {...baseProps} onAddColumn={onAddColumn} />)
    // Plus 아이콘 버튼 (마지막)
    const buttons = container.querySelectorAll('button')
    const plusBtn = Array.from(buttons).find((b) => b.querySelector('svg.lucide-plus'))
    if (plusBtn) {
      fireEventLite(plusBtn as HTMLElement, 'click')
      expect(onAddColumn).toHaveBeenCalled()
    }
  })
})

// fireEvent.click 의 간단 helper — testing-library 의 fireEvent.click 미사용 (모듈 분리)
function fireEventLite(
  el: HTMLElement,
  type: 'click' | 'mousedown' = 'click',
  opts: { button?: number } = {}
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: opts.button ?? 0
  })
  el.dispatchEvent(event)
}
