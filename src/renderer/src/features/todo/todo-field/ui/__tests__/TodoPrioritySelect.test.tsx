/**
 * features/todo/todo-field/ui/TodoPrioritySelect.test.tsx
 *
 * value → trigger 라벨 (한국어). PRIORITY_LABEL 매핑 검증.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoPrioritySelect } from '../TodoPrioritySelect'

describe('TodoPrioritySelect', () => {
  it('high → "높음"', () => {
    render(<TodoPrioritySelect value="high" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('높음')
  })

  it('medium → "보통"', () => {
    render(<TodoPrioritySelect value="medium" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('보통')
  })

  it('low → "낮음"', () => {
    render(<TodoPrioritySelect value="low" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('낮음')
  })
})
