/**
 * widgets/calendar/ui/DayView.test.tsx
 *
 * allDay schedules → "종일" 섹션. timed schedules → ScheduleBlock 렌더.
 * recurringSection prop → border-b 영역 노출.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: vi.fn(),
  pointerWithin: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => []
}))

vi.mock('@entities/schedule', () => ({
  useMoveSchedule: () => ({ mutate: vi.fn() })
}))

vi.mock('@entities/todo', () => ({
  useUpdateTodo: () => ({ mutate: vi.fn() })
}))

vi.mock('../../model/calendar-constants', () => ({
  HOUR_HEIGHT: 40,
  DND_ACTIVATION_CONSTRAINT: { distance: 5 }
}))

vi.mock('../../model/calendar-utils', () => ({
  isScheduleOnDate: () => true,
  layoutOverlappingSchedules: <T,>(items: T[]) =>
    items.map((s) => ({ schedule: s, column: 0, totalColumns: 1, span: 1 })),
  timeToPosition: () => 0,
  scheduleHeight: () => 40,
  isTodoItem: (s: { type?: string }) => s.type === 'todo'
}))

vi.mock('../../model/schedule-color', () => ({
  getScheduleColor: () => '#f00'
}))

vi.mock('../../model/schedule-style', () => ({
  getItemStyle: () => ({})
}))

vi.mock('../../model/use-day-dnd', () => ({
  useDayDnd: () => ({
    handleDragStart: vi.fn(),
    handleDragMove: vi.fn(),
    handleDragEnd: vi.fn(),
    activeSchedule: null,
    activeType: 'block',
    activeWidth: 0,
    activeHeight: 0
  })
}))

vi.mock('../../model/use-day-view-time-settings', () => ({
  useDayViewTimeSettings: () => ({ settings: { startHour: 0, endHour: 24 } })
}))

vi.mock('../../model/use-schedule-resize', () => ({
  useScheduleResize: () => ({ handleResizeStart: vi.fn(), preview: null })
}))

vi.mock('../ScheduleBlock', () => ({
  ScheduleBlock: ({ schedule }: { schedule: { title: string; id: string } }) => (
    <div data-testid={`block-${schedule.id}`}>{schedule.title}</div>
  )
}))

vi.mock('../ScheduleDetailPopover', () => ({
  ScheduleDetailPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../TimeGrid', () => ({
  TimeGrid: () => <div data-testid="time-grid" />
}))

vi.mock('../ScheduleDragOverlay', () => ({
  ScheduleDragOverlay: () => <div data-testid="drag-overlay" />
}))

import { DayView } from '../DayView'

describe('DayView', () => {
  it('TimeGrid 노출 (기본 렌더)', () => {
    render(<DayView schedules={[]} currentDate={new Date('2026-05-29')} workspaceId="ws" />)
    expect(screen.getByTestId('time-grid')).toBeInTheDocument()
  })

  it('allDay 일정 → "종일" 라벨 + 제목 노출', () => {
    render(
      <DayView
        schedules={
          [
            {
              id: 's1',
              title: 'AllDay Event',
              allDay: true,
              startAt: new Date('2026-05-29'),
              endAt: new Date('2026-05-29'),
              isDone: false
            }
          ] as unknown as Parameters<typeof DayView>[0]['schedules']
        }
        currentDate={new Date('2026-05-29')}
        workspaceId="ws"
      />
    )
    expect(screen.getByText('종일')).toBeInTheDocument()
    expect(screen.getByText('AllDay Event')).toBeInTheDocument()
  })

  it('timed 일정 추가 → 렌더 에러 없음 (smoke)', () => {
    render(
      <DayView
        schedules={
          [
            {
              id: 's1',
              title: 'Timed Event',
              allDay: false,
              startAt: new Date('2026-05-29T10:00:00Z'),
              endAt: new Date('2026-05-29T11:00:00Z'),
              isDone: false
            }
          ] as unknown as Parameters<typeof DayView>[0]['schedules']
        }
        currentDate={new Date('2026-05-29')}
        workspaceId="ws"
      />
    )
    // TimeGrid 항상 노출
    expect(screen.getByTestId('time-grid')).toBeInTheDocument()
  })

  it('recurringSection prop → 자식 노출', () => {
    render(
      <DayView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        workspaceId="ws"
        recurringSection={<div data-testid="recurring-section">Recurring</div>}
      />
    )
    expect(screen.getByTestId('recurring-section')).toBeInTheDocument()
  })

  it('allDay todo + isDone → ☑ + line-through', () => {
    const { container } = render(
      <DayView
        schedules={
          [
            {
              id: 't1',
              title: 'Done Todo',
              allDay: true,
              startAt: new Date('2026-05-29'),
              endAt: new Date('2026-05-29'),
              isDone: true,
              type: 'todo'
            }
          ] as unknown as Parameters<typeof DayView>[0]['schedules']
        }
        currentDate={new Date('2026-05-29')}
        workspaceId="ws"
      />
    )
    expect(screen.getByText('☑')).toBeInTheDocument()
    expect(container.innerHTML).toMatch(/line-through/)
  })
})
