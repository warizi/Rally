/**
 * widgets/calendar/ui/CalendarNavigation.test.tsx
 *
 * 단순 prev/next/today + title 노출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarNavigation } from '../CalendarNavigation'

describe('CalendarNavigation', () => {
  it('title 텍스트 노출', () => {
    render(
      <CalendarNavigation title="2026년 5월" onPrev={vi.fn()} onNext={vi.fn()} onToday={vi.fn()} />
    )
    expect(screen.getByText('2026년 5월')).toBeInTheDocument()
  })

  it('오늘 버튼 클릭 → onToday', () => {
    const fn = vi.fn()
    render(<CalendarNavigation title="x" onPrev={vi.fn()} onNext={vi.fn()} onToday={fn} />)
    fireEvent.click(screen.getByRole('button', { name: '오늘' }))
    expect(fn).toHaveBeenCalled()
  })

  it('< 버튼 클릭 → onPrev', () => {
    const onPrev = vi.fn()
    const { container } = render(
      <CalendarNavigation title="x" onPrev={onPrev} onNext={vi.fn()} onToday={vi.fn()} />
    )
    const buttons = container.querySelectorAll('button')
    // 순서: 오늘 / Prev (ChevronLeft) / Next (ChevronRight)
    fireEvent.click(buttons[1])
    expect(onPrev).toHaveBeenCalled()
  })

  it('> 버튼 클릭 → onNext', () => {
    const onNext = vi.fn()
    const { container } = render(
      <CalendarNavigation title="x" onPrev={vi.fn()} onNext={onNext} onToday={vi.fn()} />
    )
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[2])
    expect(onNext).toHaveBeenCalled()
  })
})
