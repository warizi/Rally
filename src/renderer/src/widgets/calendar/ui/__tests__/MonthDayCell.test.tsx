/**
 * widgets/calendar/ui/MonthDayCell.test.tsx
 *
 * day.isCurrentMonth + isSelected + isOver(DnD preview) + onClick 분기.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const dnd = vi.hoisted(() => ({ isOver: false }))

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: dnd.isOver })
}))

import { MonthDayCell } from '../MonthDayCell'
import type { MonthGridDay } from '../../model/calendar-utils'

function day(over: Partial<MonthGridDay> = {}): MonthGridDay {
  return { date: new Date('2026-05-29'), isCurrentMonth: true, ...over } as MonthGridDay
}

describe('MonthDayCell', () => {
  it('날짜 표시 + onClick 호출', () => {
    dnd.isOver = false
    const fn = vi.fn()
    render(
      <MonthDayCell day={day()} isSelected={false} onClick={fn}>
        <div>schedules</div>
      </MonthDayCell>
    )
    expect(screen.getByText('29')).toBeInTheDocument()
    fireEvent.click(screen.getByText('29').closest('div')!)
    expect(fn).toHaveBeenCalled()
  })

  it('children 노출', () => {
    dnd.isOver = false
    render(
      <MonthDayCell day={day()} isSelected={false} onClick={vi.fn()}>
        <div data-testid="schedules-content" />
      </MonthDayCell>
    )
    expect(screen.getByTestId('schedules-content')).toBeInTheDocument()
  })

  it('isOver + previewSchedule → preview bar 노출', () => {
    dnd.isOver = true
    render(
      <MonthDayCell
        day={day()}
        isSelected={false}
        onClick={vi.fn()}
        previewSchedule={
          {
            id: 's',
            title: 'Preview',
            startAt: new Date(),
            endAt: new Date()
          } as unknown as import('@entities/schedule').ScheduleItem
        }
      >
        <div />
      </MonthDayCell>
    )
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })
})
