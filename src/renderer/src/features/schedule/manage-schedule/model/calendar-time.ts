import { differenceInMinutes } from 'date-fns'
import { START_HOUR } from './calendar-constants'

export interface TimeSlot {
  hour: number
  label: string
}

export function getTimeSlots(): TimeSlot[] {
  return Array.from({ length: 24 - START_HOUR }, (_, i) => ({
    hour: START_HOUR + i,
    label: `${String(START_HOUR + i).padStart(2, '0')}:00`
  }))
}

export function timeToPosition(date: Date, hourHeight: number): number {
  return (date.getHours() - START_HOUR + date.getMinutes() / 60) * hourHeight
}

export function scheduleHeight(startAt: Date, endAt: Date, hourHeight: number): number {
  return Math.max((differenceInMinutes(endAt, startAt) / 60) * hourHeight, 20)
}
