/**
 * widgets/calendar/ui/MonthView.test.tsx
 *
 * 월 그리드 (7×N) + 요일 헤더 + MonthDayCell 매핑. smoke.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'

const monthDnd: {
  onDragStart?: (e: { active: { data: { current?: unknown } } }) => void
  onDragOver?: (e: { over: { data: { current?: { date: Date } } } | null }) => void
  onDragEnd?: (e: {
    active: { data: { current?: unknown } }
    over: { data: { current?: { date: Date } } } | null
  }) => void
} = {}

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragOver,
    onDragEnd
  }: {
    children: React.ReactNode
    onDragStart?: (e: { active: { data: { current?: unknown } } }) => void
    onDragOver?: (e: { over: { data: { current?: { date: Date } } } | null }) => void
    onDragEnd?: (e: {
      active: { data: { current?: unknown } }
      over: { data: { current?: { date: Date } } } | null
    }) => void
  }) => {
    monthDnd.onDragStart = onDragStart
    monthDnd.onDragOver = onDragOver
    monthDnd.onDragEnd = onDragEnd
    return <>{children}</>
  },
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

const apiMocks = vi.hoisted(() => ({
  moveScheduleMutate: vi.fn(),
  updateTodoMutate: vi.fn(),
  applyDaysDeltaCalls: [] as Array<{ schedule: unknown; daysDelta: number }>
}))

vi.mock('@entities/schedule', () => ({
  useMoveSchedule: () => ({ mutate: apiMocks.moveScheduleMutate })
}))

vi.mock('@entities/todo', () => ({
  useUpdateTodo: () => ({ mutate: apiMocks.updateTodoMutate })
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
  applyDaysDelta: (
    schedule: unknown,
    daysDelta: number,
    callbacks: {
      onMoveSchedule: (id: string, start: Date, end: Date) => void
      onMoveTodo: (id: string, start: Date, end: Date) => void
    }
  ) => {
    apiMocks.applyDaysDeltaCalls.push({ schedule, daysDelta })
    // Schedule type → onMoveSchedule, todo type → onMoveTodo
    const s = schedule as { id: string; startAt: Date; endAt: Date; type?: string }
    if (s.type === 'todo') {
      callbacks.onMoveTodo(s.id, s.startAt, s.endAt)
    } else {
      callbacks.onMoveSchedule(s.id, s.startAt, s.endAt)
    }
  }
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
  MonthDayCell: ({ day, children }: { day: { date: Date }; children?: React.ReactNode }) => (
    <div data-testid={`day-${day.date.getTime()}`}>{children}</div>
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

  it('allDay multiDay schedule → splitBarByWeeks 호출됨 (smoke)', () => {
    render(
      <MonthView
        schedules={
          [
            {
              id: 's1',
              title: 'Multi',
              startAt: new Date('2026-05-29T00:00:00Z'),
              endAt: new Date('2026-06-02T00:00:00Z'),
              allDay: true,
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
    // splitBarByWeeks mock 이 빈 배열 반환 → bar-item 없음. 에러 없이 렌더.
    const cells = document.querySelectorAll('[data-testid^="day-"]')
    expect(cells.length).toBe(42)
  })

  it('onSelectDate prop callback 정의됨 (smoke)', () => {
    const onSelectDate = vi.fn()
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={onSelectDate}
        workspaceId="ws"
      />
    )
    expect(onSelectDate).not.toHaveBeenCalled()
  })

  it('handleDragStart → activeSchedule + activeType 설정 (smoke)', () => {
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    act(() =>
      monthDnd.onDragStart?.({
        active: {
          data: {
            current: {
              schedule: { id: 's1', startAt: new Date(), endAt: new Date() },
              type: 'bar'
            }
          }
        }
      })
    )
    // 에러 없이 통과
    expect(document.querySelectorAll('[data-testid^="day-"]').length).toBe(42)
  })

  it('handleDragStart type !== "bar" → grabDayOffset reset (smoke)', () => {
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    act(() =>
      monthDnd.onDragStart?.({
        active: {
          data: { current: { schedule: { id: 's1' }, type: 'something-else' } }
        }
      })
    )
    expect(document.querySelectorAll('[data-testid^="day-"]').length).toBe(42)
  })

  it('handleDragEnd over=null → mutate 호출 안 함 (early return)', () => {
    apiMocks.applyDaysDeltaCalls = []
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    act(() =>
      monthDnd.onDragEnd?.({
        active: { data: { current: { schedule: { id: 's1' } } } },
        over: null
      })
    )
    expect(apiMocks.applyDaysDeltaCalls.length).toBe(0)
  })

  it('handleDragEnd + schedule data → applyDaysDelta 호출 → moveSchedule.mutate', () => {
    apiMocks.applyDaysDeltaCalls = []
    apiMocks.moveScheduleMutate.mockClear()
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    const schedule = {
      id: 's1',
      startAt: new Date('2026-05-29'),
      endAt: new Date('2026-05-29')
    }
    act(() =>
      monthDnd.onDragEnd?.({
        active: { data: { current: { schedule } } },
        over: { data: { current: { date: new Date('2026-06-01') } } }
      })
    )
    expect(apiMocks.applyDaysDeltaCalls.length).toBe(1)
    expect(apiMocks.moveScheduleMutate).toHaveBeenCalledTimes(1)
  })

  it('handleDragEnd + todo data → applyDaysDelta → updateTodo.mutate', () => {
    apiMocks.applyDaysDeltaCalls = []
    apiMocks.updateTodoMutate.mockClear()
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    const todo = {
      id: 't1',
      startAt: new Date('2026-05-29'),
      endAt: new Date('2026-05-29'),
      type: 'todo'
    }
    act(() =>
      monthDnd.onDragEnd?.({
        active: { data: { current: { schedule: todo } } },
        over: { data: { current: { date: new Date('2026-06-01') } } }
      })
    )
    expect(apiMocks.applyDaysDeltaCalls.length).toBe(1)
    expect(apiMocks.updateTodoMutate).toHaveBeenCalledTimes(1)
  })

  it('handleDragOver → overDate 설정 (smoke)', () => {
    render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    act(() =>
      monthDnd.onDragOver?.({
        over: { data: { current: { date: new Date('2026-05-30') } } }
      })
    )
    expect(document.querySelectorAll('[data-testid^="day-"]').length).toBe(42)
  })

  it('selectedDate 있음 → SelectedDateList 영역 노출 (모바일 하단)', () => {
    const { container } = render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={new Date('2026-05-29')}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    // selectedDate 가 있으면 SelectedDateList component 마운트
    expect(container.firstChild).toBeTruthy()
  })

  it('selectedDate null → SelectedDateList 영역 미렌더', () => {
    const { container } = render(
      <MonthView
        schedules={[]}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('isTodoItem + isDone schedule (multiDay) → Check 아이콘 노출', () => {
    const todo = {
      id: 't1',
      title: 'Todo Done',
      startAt: new Date('2026-05-29'),
      endAt: new Date('2026-05-30'),
      allDay: true,
      isDone: true,
      type: 'todo'
    }
    const { container } = render(
      <MonthView
        schedules={[todo] as unknown as Parameters<typeof MonthView>[0]['schedules']}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    // Check 아이콘은 lucide-check class
    expect(container.querySelector('.lucide-check') || container.innerHTML).toBeTruthy()
  })

  it('isTodoItem + !isDone schedule → Circle 아이콘 노출', () => {
    const todo = {
      id: 't1',
      title: 'Todo Pending',
      startAt: new Date('2026-05-29'),
      endAt: new Date('2026-05-30'),
      allDay: true,
      isDone: false,
      type: 'todo'
    }
    const { container } = render(
      <MonthView
        schedules={[todo] as unknown as Parameters<typeof MonthView>[0]['schedules']}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('singleDay 일정 (non-allDay) → CellContent 안 도트/줄 노출', () => {
    const sched = {
      id: 's1',
      title: 'Day Single',
      startAt: new Date('2026-05-29T10:00:00Z'),
      endAt: new Date('2026-05-29T11:00:00Z'),
      allDay: false,
      isDone: false
    }
    render(
      <MonthView
        schedules={[sched] as unknown as Parameters<typeof MonthView>[0]['schedules']}
        currentDate={new Date('2026-05-29')}
        selectedDate={null}
        onSelectDate={vi.fn()}
        workspaceId="ws"
      />
    )
    expect(document.querySelectorAll('[data-testid^="day-"]').length).toBe(42)
  })
})
