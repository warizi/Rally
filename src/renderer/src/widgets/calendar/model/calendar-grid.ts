import { addDays, endOfMonth, startOfWeek, endOfWeek, startOfDay, isSameDay } from 'date-fns'

export interface MonthGridDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
}

export function getMonthGrid(year: number, month: number): MonthGridDay[][] {
  const today = startOfDay(new Date())
  const firstDay = new Date(year, month, 1)
  const monthStart = startOfWeek(firstDay)
  const monthEnd = endOfWeek(endOfMonth(firstDay))

  const weeks: MonthGridDay[][] = []
  let current = monthStart

  while (current <= monthEnd) {
    const week: MonthGridDay[] = []
    for (let i = 0; i < 7; i++) {
      week.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        isToday: isSameDay(current, today)
      })
      current = addDays(current, 1)
    }
    weeks.push(week)
  }

  return weeks
}

export function getWeekDates(date: Date): Date[] {
  const weekStart = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}
