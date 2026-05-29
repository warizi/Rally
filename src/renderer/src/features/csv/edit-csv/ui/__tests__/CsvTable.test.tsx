/**
 * features/csv/edit-csv/ui/CsvTable.test.tsx
 *
 * 헤더 + 데이터 행 렌더 smoke. virtualizer mock.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
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
    // virtualizer 가 빈 list 반환하므로 빈 컨테이너지만 렌더는 성공
    expect(container.firstChild).toBeTruthy()
  })

  it('빈 데이터 → 에러 없이 렌더 (smoke)', () => {
    const { container } = render(<CsvTable {...baseProps} headers={[]} data={[]} />)
    expect(container.firstChild).toBeTruthy()
  })
})
