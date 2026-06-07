/**
 * features/csv/edit-csv/ui/EditableCell.test.tsx
 *
 * EditableCell 은 표시 전용(읽기). 실제 편집은 CsvCellEditor 가 담당.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditableCell } from '../EditableCell'

describe('EditableCell — 표시 전용', () => {
  it('value 노출 + cursor-text', () => {
    render(<EditableCell value="hi" />)
    expect(screen.getByText('hi')).toBeInTheDocument()
  })

  it('빈 값 → non-breaking space (\\u00A0) 노출 (height 유지)', () => {
    const { container } = render(<EditableCell value="" />)
    expect(container.textContent).toBe(' ')
  })

  it('input 을 렌더하지 않음 (편집은 CsvCellEditor 담당)', () => {
    render(<EditableCell value="x" />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
