import { differenceInMinutes } from 'date-fns'
import { DEFAULT_START_HOUR, DEFAULT_END_HOUR } from './calendar-constants'

export interface TimeSlot {
  hour: number
  label: string
}

export function getTimeSlots(
  startHour: number = DEFAULT_START_HOUR,
  endHour: number = DEFAULT_END_HOUR
): TimeSlot[] {
  return Array.from({ length: endHour - startHour }, (_, i) => ({
    hour: startHour + i,
    label: `${String(startHour + i).padStart(2, '0')}:00`
  }))
}

export function timeToPosition(
  date: Date,
  hourHeight: number,
  startHour: number = DEFAULT_START_HOUR
): number {
  return (date.getHours() - startHour + date.getMinutes() / 60) * hourHeight
}

export function scheduleHeight(startAt: Date, endAt: Date, hourHeight: number): number {
  return Math.max((differenceInMinutes(endAt, startAt) / 60) * hourHeight, 20)
}
