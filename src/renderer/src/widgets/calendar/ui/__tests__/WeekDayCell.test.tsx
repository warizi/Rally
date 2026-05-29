/**
 * widgets/calendar/ui/WeekDayCell.test.tsx
 *
 * 매칭되는 schedule 만 렌더. isTodo + isDone 표식.
 * isOver + activeSchedule → preview 표시.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  isOver: false
}))

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: mocks.isOver }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false
  })
}))

vi.mock('../../model/calendar-predicates', () => ({
  isScheduleOnDate: () => true,
  isTodoItem: (s: { type?: string }) => s.type === 'todo'
}))

vi.mock('../../model/schedule-color', () => ({
  getScheduleColor: () => '#ff0000'
}))

vi.mock('../../model/schedule-style', () => ({
  getItemStyle: () => ({})
}))

vi.mock('../ScheduleDetailPopover', () => ({
  ScheduleDetailPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import { WeekDayCell } from '../WeekDayCell'

beforeEach(() => {
  mocks.isOver = false
})

const baseProps = {
  date: new Date('2026-05-29'),
  dayIdx: 0,
  workspaceId: 'ws',
  barAreaHeight: 20,
  activeSchedule: null
}

describe('WeekDayCell', () => {
  it('빈 schedules → 아무 일정도 렌더 안 됨', () => {
    render(<WeekDayCell {...baseProps} schedules={[]} />)
    // No schedule titles
  })

  it('schedules → title 노출', () => {
    render(
      <WeekDayCell
        {...baseProps}
        schedules={
          [
            {
              id: 's1',
              title: '회의',
              startAt: new Date('2026-05-29T10:00:00Z'),
              endAt: new Date('2026-05-29T11:00:00Z'),
              allDay: false,
              isDone: false
            }
          ] as unknown as Parameters<typeof WeekDayCell>[0]['schedules']
        }
      />
    )
    expect(screen.getByText('회의')).toBeInTheDocument()
  })

  it('isTodo + isDone → line-through 클래스', () => {
    const { container } = render(
      <WeekDayCell
        {...baseProps}
        schedules={
          [
            {
              id: 't1',
              title: 'TodoSched',
              startAt: new Date('2026-05-29T10:00:00Z'),
              endAt: new Date('2026-05-29T11:00:00Z'),
              allDay: true,
              isDone: true,
              type: 'todo'
            }
          ] as unknown as Parameters<typeof WeekDayCell>[0]['schedules']
        }
      />
    )
    expect(screen.getByText('TodoSched').className).toMatch(/line-through/)
    expect(container.innerHTML).not.toMatch(/HH:mm/) // allDay 라서 시간 미노출
  })

  it('isOver=true + activeSchedule → preview 노출', () => {
    mocks.isOver = true
    render(
      <WeekDayCell
        {...baseProps}
        schedules={[]}
        activeSchedule={
          {
            id: 'active',
            title: 'Preview Item',
            startAt: new Date(),
            endAt: new Date(),
            allDay: false,
            isDone: false
          } as unknown as Parameters<typeof WeekDayCell>[0]['activeSchedule']
        }
      />
    )
    expect(screen.getByText('Preview Item')).toBeInTheDocument()
  })

  it('isOver=true + activeSchedule=null → preview 미노출', () => {
    mocks.isOver = true
    render(<WeekDayCell {...baseProps} schedules={[]} />)
    // no preview
  })

  it('isOver=true → bg-accent/30 클래스', () => {
    mocks.isOver = true
    const { container } = render(<WeekDayCell {...baseProps} schedules={[]} />)
    expect(container.innerHTML).toMatch(/bg-accent/)
  })
})
