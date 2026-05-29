/**
 * widgets/calendar/ui/CalendarViewToolbar.test.tsx
 *
 * 월/주/일 ToggleGroup — 클릭 시 onViewTypeChange 호출 + 빈 값은 호출 안 함.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarViewToolbar } from '../CalendarViewToolbar'

describe('CalendarViewToolbar', () => {
  it('현재 viewType 의 버튼이 pressed=true', () => {
    render(<CalendarViewToolbar viewType="week" onViewTypeChange={vi.fn()} />)
    const weekBtn = screen.getByRole('radio', { name: '주' })
    expect(weekBtn).toHaveAttribute('data-state', 'on')
  })

  it('다른 옵션 클릭 → onViewTypeChange 호출', () => {
    const fn = vi.fn()
    render(<CalendarViewToolbar viewType="month" onViewTypeChange={fn} />)
    fireEvent.click(screen.getByRole('radio', { name: '일' }))
    expect(fn).toHaveBeenCalledWith('day')
  })

  it('이미 active 한 버튼 재클릭 → onValueChange("") → onViewTypeChange 호출 안 함', () => {
    const fn = vi.fn()
    render(<CalendarViewToolbar viewType="month" onViewTypeChange={fn} />)
    fireEvent.click(screen.getByRole('radio', { name: '월' }))
    expect(fn).not.toHaveBeenCalled()
  })
})
