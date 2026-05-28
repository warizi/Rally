import { addDays } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import { isTodoItem } from './calendar-predicates'

export function moveScheduleByDays(
  schedule: ScheduleItem,
  daysDelta: number
): { startAt: Date; endAt: Date } {
  return {
    startAt: addDays(schedule.startAt, daysDelta),
    endAt: addDays(schedule.endAt, daysDelta)
  }
}

export function moveScheduleByMinutes(
  schedule: ScheduleItem,
  minutesDelta: number
): { startAt: Date; endAt: Date } {
  const snapped = Math.round(minutesDelta / 15) * 15
  const msOffset = snapped * 60 * 1000
  return {
    startAt: new Date(schedule.startAt.getTime() + msOffset),
    endAt: new Date(schedule.endAt.getTime() + msOffset)
  }
}

interface DaysDeltaCallbacks {
  onMoveSchedule: (id: string, start: Date, end: Date) => void
  onMoveTodo: (id: string, start: Date, end: Date) => void
}

export function applyDaysDelta(
  schedule: ScheduleItem,
  daysDelta: number,
  callbacks: DaysDeltaCallbacks
): void {
  if (daysDelta === 0) return

  const { startAt, endAt } = moveScheduleByDays(schedule, daysDelta)

  if (isTodoItem(schedule)) {
    callbacks.onMoveTodo(schedule.id.slice(5), startAt, endAt)
  } else {
    callbacks.onMoveSchedule(schedule.id, startAt, endAt)
  }
}
