/**
 * widgets/calendar/ui/MonthView.test.tsx
 *
 * 월 그리드 (7×N) + 요일 헤더 + MonthDayCell 매핑. smoke.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  pointerWithin: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false
  })
}))

vi.mock('@entities/schedule', () => ({
  useMoveSchedule: () => ({ mutate: vi.fn() })
}))

vi.mock('@entities/todo', () => ({
  useUpdateTodo: () => ({ mutate: vi.fn() })
}))

vi.mock('../../model/calendar-constants', () => ({
  WEEKDAY_LABELS: ['일', '월', '화', '수', '목', '금', '토'],
  MONTH_BAR_HEIGHT: 20,
  BAR_GAP: 2,
  DND_ACTIVATION_CONSTRAINT: { distance: 5 }
}))

vi.mock('../../model/calendar-utils', () => {
  const base = new Date('2026-05-01').getTime()
  // 6 weeks × 7 days = grid[week][day]
  return {
    getMonthGrid: () =>
      Array.from({ length: 6 }, (_, w) =>
        Array.from({ length: 7 }, (_, d) => ({
          date: new Date(base + (w * 7 + d) * 86400000),
          isCurrentMonth: w >= 1 && w < 5
        }))
      ),
    isScheduleOnDate: () => true,
    splitBarByWeeks: () => [],
    isTodoItem: (s: { type?: string }) => s.type === 'todo'
  }
})

vi.mock('../../model/calendar-layout', () => ({
  assignLanes: () => []
}))

vi.mock('../../model/calendar-move', () => ({
  applyDaysDelta: vi.fn()
}))

vi.mock('../../model/schedule-color', () => ({
  getScheduleColor: () => '#f00'
}))

vi.mock('../../model/schedule-style', () => ({
  getItemStyle: () => ({}),
  getItemDotStyle: () => ({})
}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../MonthDayCell', () => ({
  MonthDayCell: ({ day }: { day: { date: Date } }) => (
    <div data-testid={`day-${day.date.getTime()}`} />
  )
}))

vi.mock('../ScheduleDot', () => ({
  ScheduleDot: () => <span data-testid="dot" />
}))

vi.mock('../ScheduleDetailPopover', () => ({
  ScheduleDetailPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../ScheduleDragOverlay', () => ({
  ScheduleDragOverlay: () => null
}))

vi.mock('../ScheduleBarItem', () => ({
  ScheduleBarItem: () => <div data-testid="bar-item" />
}))

import { MonthView } from '../MonthView'

describe('MonthView', () => {
  it('요일 헤더 (일~토) 7개 노출', () => {
    const { container } = render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(container.innerHTML).toMatch(/일.*토/s)
  })

  it('42개 MonthDayCell (6주 × 7일) 매핑', () => {
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    const cells = document.querySelectorAll('[data-testid^="day-"]')
    expect(cells.length).toBe(42)
  })

  it('schedules 있음 → 렌더 에러 없음 (smoke)', () => {
    render(
      <MonthView
        schedules={
          [
            {
              id: 's1',
              title: 'X',
              startAt: new Date('2026-05-29T10:00:00Z'),
              endAt: new Date('2026-05-29T11:00:00Z'),
              allDay: false,
              isDone: false
            }
          ] as unknown as Parameters<typeof MonthView>[0]['schedules']
        }
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    const cells = document.querySelectorAll('[data-testid^="day-"]')
    expect(cells.length).toBe(42)
  })

  it('selectedDate prop → 전달됨 (다른 날짜)', () => {
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={new Date('2026-05-15')}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    const cells = document.querySelectorAll('[data-testid^="day-"]')
    expect(cells.length).toBe(42)
  })

  it('일요일 라벨 → 빨간색 스타일 클래스 (text-red-500)', () => {
    const { container } = render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(container.querySelector('.text-red-500')).toBeInTheDocument()
  })

  it('토요일 라벨 → 파란색 스타일 클래스 (text-blue-500)', () => {
    const { container } = render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(container.querySelector('.text-blue-500')).toBeInTheDocument()
  })

  it('빈 schedules 배열 → bar-item 노출 없음', () => {
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(document.querySelectorAll('[data-testid="bar-item"]').length).toBe(0)
  })
})
