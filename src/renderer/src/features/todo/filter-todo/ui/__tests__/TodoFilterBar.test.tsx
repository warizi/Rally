/**
 * features/todo/filter-todo/ui/TodoFilterBar.test.tsx
 *
 * showStatus 분기 + active filter X 버튼 + 필터 변경 콜백.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TodoFilterBar } from '../TodoFilterBar'
import { DEFAULT_FILTER, type TodoFilter } from '@entities/todo'

vi.mock('@shared/ui/date-picker-button', () => ({
  DatePickerButton: ({ placeholder }: { placeholder: string }) => (
    <div data-testid="date-picker">{placeholder}</div>
  )
}))

describe('TodoFilterBar', () => {
  it('showStatus=true (기본) → 2개 Select (status + priority)', () => {
    render(<TodoFilterBar filter={DEFAULT_FILTER} onFilterChange={vi.fn()} />)
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('showStatus=false → 1개 Select 만 (priority)', () => {
    render(<TodoFilterBar filter={DEFAULT_FILTER} onFilterChange={vi.fn()} showStatus={false} />)
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('4개 DatePickerButton (start/end + due start/end) 노출', () => {
    render(<TodoFilterBar filter={DEFAULT_FILTER} onFilterChange={vi.fn()} />)
    expect(screen.getAllByTestId('date-picker')).toHaveLength(4)
  })

  it('필터 비활성 → 초기화 X 버튼 미노출', () => {
    render(<TodoFilterBar filter={DEFAULT_FILTER} onFilterChange={vi.fn()} />)
    expect(screen.queryByTitle('필터 초기화')).not.toBeInTheDocument()
  })

  it('필터 활성 (priority=high) → 초기화 X 버튼 노출', () => {
    const active: TodoFilter = { ...DEFAULT_FILTER, priority: 'high' }
    render(<TodoFilterBar filter={active} onFilterChange={vi.fn()} />)
    expect(screen.getByTitle('필터 초기화')).toBeInTheDocument()
  })

  it('초기화 클릭 → onFilterChange(DEFAULT_FILTER)', () => {
    const fn = vi.fn()
    const active: TodoFilter = { ...DEFAULT_FILTER, priority: 'high' }
    render(<TodoFilterBar filter={active} onFilterChange={fn} />)
    fireEvent.click(screen.getByTitle('필터 초기화'))
    expect(fn).toHaveBeenCalledWith(DEFAULT_FILTER)
  })
})
