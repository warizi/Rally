import { addDays, startOfDay } from 'date-fns'
import type { ScheduleItem, SchedulePriority } from '@entities/schedule'
import type { MonthGridDay } from '../calendar-grid'

export function makeScheduleItem(overrides?: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: 'sched-1',
    workspaceId: 'ws-1',
    title: 'Test Schedule',
    description: null,
    location: null,
    allDay: false,
    startAt: new Date('2026-03-02T09:00:00'),
    endAt: new Date('2026-03-02T10:00:00'),
    color: null,
    priority: 'medium' as SchedulePriority,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

export function makeMonthGrid(year: number, month: number): MonthGridDay[][] {
  const firstDay = new Date(year, month, 1)
  const startSunday = startOfDay(
    addDays(firstDay, -firstDay.getDay()),
  )

  const weeks: MonthGridDay[][] = []
  let current = startSunday

  for (let w = 0; w < 5; w++) {
    const week: MonthGridDay[] = []
    for (let d = 0; d < 7; d++) {
      week.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        isToday: false,
      })
      current = addDays(current, 1)
    }
    weeks.push(week)
  }

  return weeks
}
