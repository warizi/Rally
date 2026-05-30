/**
 * widgets/calendar/ui/WeekView.test.tsx
 *
 * 주별 요일 헤더 + WeekDayCell 7개 렌더 + multiDay bars + singleDay schedules.
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

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

vi.mock('../../model/calendar-constants', () => ({
  WEEKDAY_LABELS: ['일', '월', '화', '수', '목', '금', '토'],
  WEEK_BAR_HEIGHT: 20,
  BAR_GAP: 2,
  DND_ACTIVATION_CONSTRAINT: { distance: 5 }
}))

vi.mock('../../model/calendar-utils', () => ({
  getWeekDates: (d: Date) =>
    Array.from({ length: 7 }, (_, i) => new Date(d.getTime() + i * 86400000)),
  isScheduleOnDate: () => true,
  isTodoItem: (s: { type?: string }) => s.type === 'todo'
}))

const layoutMocks = vi.hoisted(() => ({
  weekBars: [] as Array<{ schedule: unknown; lane: number; startCol: number; span: number }>
}))

vi.mock('../../model/calendar-layout', () => ({
  computeWeekBars: () => layoutMocks.weekBars
}))

vi.mock('../../model/calendar-move', () => ({
  applyDaysDelta: vi.fn()
}))

vi.mock('../../model/schedule-color', () => ({
  getScheduleColor: () => '#f00'
}))

vi.mock('../../model/schedule-style', () => ({
  getItemDotStyle: () => ({})
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

vi.mock('../WeekDayCell', () => ({
  WeekDayCell: ({ dayIdx }: { dayIdx: number }) => <div data-testid={`day-cell-${dayIdx}`} />
}))

import { WeekView } from '../WeekView'

describe('WeekView', () => {
  it('7개 WeekDayCell 노출', () => {
    render(
      <WeekView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`day-cell-${i}`)).toBeInTheDocument()
    }
  })

  it('요일 라벨 (일~토) 노출', () => {
    const { container } = render(
      <WeekView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(container.innerHTML).toMatch(/일/)
    expect(container.innerHTML).toMatch(/월/)
    expect(container.innerHTML).toMatch(/토/)
  })

  it('schedules 있음 → 렌더 에러 없음 (smoke)', () => {
    render(
      <WeekView
        schedules={
          [
            {
              id: 's1',
              title: 'Sched',
              startAt: new Date('2026-05-29T10:00:00Z'),
              endAt: new Date('2026-05-29T11:00:00Z'),
              allDay: false,
              isDone: false
            }
          ] as unknown as Parameters<typeof WeekView>[0]['schedules']
        }
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(screen.getByTestId('day-cell-0')).toBeInTheDocument()
  })

  it('selectedDate 가 주 안에 있음 → bg-primary 클래스 노출 (small 뷰)', () => {
    const { container } = render(
      <WeekView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={new Date('2026-05-29')}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(container.querySelector('.bg-primary')).toBeInTheDocument()
  })

  it('multiDay schedule (allDay) → 렌더 에러 없음 (7 cell 유지)', () => {
    render(
      <WeekView
        schedules={
          [
            {
              id: 'all-day-1',
              title: 'AllDayEvent',
              startAt: new Date('2026-05-29T00:00:00Z'),
              endAt: new Date('2026-05-30T00:00:00Z'),
              allDay: true,
              isDone: false
            }
          ] as unknown as Parameters<typeof WeekView>[0]['schedules']
        }
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`day-cell-${i}`)).toBeInTheDocument()
    }
  })

  it('small 뷰 날짜 버튼 클릭 → onSelectDate 호출', () => {
    const onSelectDate = vi.fn()
    render(
      <WeekView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={onSelectDate}
        workspaceId="ws"
      />
    )
    // small 뷰의 7개 요일 버튼 중 첫번째 클릭
    const dayBtns = screen.getAllByRole('button')
    if (dayBtns.length > 0) {
      dayBtns[0].click()
    }
    expect(onSelectDate).toHaveBeenCalled()
  })

  it('weekBars 데이터 있음 → bar-area 영역 노출 (smoke 렌더)', () => {
    layoutMocks.weekBars = [
      { schedule: { id: 's1', title: 'Bar', allDay: true } as never, lane: 0, startCol: 0, span: 3 }
    ]
    render(
      <WeekView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(screen.getAllByTestId('bar-item').length).toBeGreaterThan(0)
    layoutMocks.weekBars = []
  })

  it('singleDay + allDay 분류 분기 — multi 와 single 동시', () => {
    render(
      <WeekView
        schedules={
          [
            {
              id: 'm1',
              title: 'MultiAllDay',
              startAt: new Date('2026-05-29T00:00:00Z'),
              endAt: new Date('2026-05-31T00:00:00Z'),
              allDay: true,
              isDone: false
            },
            {
              id: 's2',
              title: 'SingleTimed',
              startAt: new Date('2026-05-29T10:00:00Z'),
              endAt: new Date('2026-05-29T11:00:00Z'),
              allDay: false,
              isDone: false
            }
          ] as unknown as Parameters<typeof WeekView>[0]['schedules']
        }
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(screen.getByTestId('day-cell-0')).toBeInTheDocument()
  })

  it('singleDay 일정 (non-allDay) + currentDate 매칭 → smoke 렌더', () => {
    render(
      <WeekView
        schedules={
          [
            {
              id: 's1',
              title: 'Single',
              startAt: new Date('2026-05-29T14:00:00Z'),
              endAt: new Date('2026-05-29T15:00:00Z'),
              allDay: false,
              isDone: false
            }
          ] as unknown as Parameters<typeof WeekView>[0]['schedules']
        }
        currentDate={new Date('2026-05-29')}
        selectedDate={new Date('2026-05-29')}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(screen.getByTestId('day-cell-0')).toBeInTheDocument()
  })
})
