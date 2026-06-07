/**
 * features/csv/edit-csv/ui/EditableColumnHeader.test.tsx
 *
 * 표시 전용: 이름 노출, 더블클릭 → onStartEdit, 삭제 버튼 → onRemove.
 * 실제 편집/입력은 floating CsvCellEditor 가 담당.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableColumnHeader } from '../EditableColumnHeader'

describe('EditableColumnHeader — 표시 전용', () => {
  it('이름 노출', () => {
    render(
      <EditableColumnHeader name="col1" colIndex={0} onRemove={vi.fn()} onStartEdit={vi.fn()} />
    )
    expect(screen.getByText('col1')).toBeInTheDocument()
  })

  it('더블클릭 → onStartEdit 호출', () => {
    const onStartEdit = vi.fn()
    render(
      <EditableColumnHeader name="col1" colIndex={0} onRemove={vi.fn()} onStartEdit={onStartEdit} />
    )
    fireEvent.doubleClick(screen.getByText('col1'))
    expect(onStartEdit).toHaveBeenCalled()
  })

  it('삭제 버튼 클릭 → onRemove(colIndex)', () => {
    const onRemove = vi.fn()
    render(
      <EditableColumnHeader name="col1" colIndex={3} onRemove={onRemove} onStartEdit={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onRemove).toHaveBeenCalledWith(3)
  })

  it('input 을 렌더하지 않음 (편집은 CsvCellEditor 담당)', () => {
    render(<EditableColumnHeader name="x" colIndex={0} onRemove={vi.fn()} onStartEdit={vi.fn()} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
