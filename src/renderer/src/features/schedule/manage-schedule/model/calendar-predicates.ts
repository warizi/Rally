import { startOfDay, endOfDay } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'

export function isTodoItem(schedule: ScheduleItem): boolean {
  return schedule.id.startsWith('todo:')
}

export function isScheduleOnDate(schedule: ScheduleItem, date: Date): boolean {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  return schedule.startAt <= dayEnd && schedule.endAt >= dayStart
}
