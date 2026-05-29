/**
 * features/todo/todo-field/ui/TodoStatusSelect.test.tsx
 *
 * value → trigger 라벨, onValueChange → onChange.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoStatusSelect } from '../TodoStatusSelect'

describe('TodoStatusSelect', () => {
  it('value="진행중" → trigger 에 라벨 노출', () => {
    render(<TodoStatusSelect value="진행중" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('진행중')
  })

  it('value="완료" → 라벨 노출', () => {
    render(<TodoStatusSelect value="완료" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('완료')
  })

  it('value="할일" → 라벨 노출', () => {
    render(<TodoStatusSelect value="할일" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('할일')
  })
})
