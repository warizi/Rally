import { useState, useMemo } from 'react'
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  format
} from 'date-fns'
import { ko } from 'date-fns/locale'
import type { ScheduleDateRange } from '@entities/schedule'

export type CalendarViewType = 'month' | 'week' | 'day'

interface UseCalendarOptions {
  initialViewType?: CalendarViewType
  initialDate?: string // ISO string (tabSearchParams에서 복원)
}

interface UseCalendarReturn {
  currentDate: Date
  selectedDate: Date | null
  viewType: CalendarViewType
  setViewType: (type: CalendarViewType) => void
  selectDate: (date: Date) => void
  goToday: () => void
  goPrev: () => void
  goNext: () => void
  title: string
  dateRange: ScheduleDateRange
}

export function useCalendar(options?: UseCalendarOptions): UseCalendarReturn {
  const [viewType, setViewType] = useState<CalendarViewType>(options?.initialViewType ?? 'month')
  const [currentDate, setCurrentDate] = useState<Date>(
    options?.initialDate ? new Date(options.initialDate) : new Date()
  )
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  function selectDate(date: Date): void {
    setSelectedDate(date)
    setCurrentDate(date)
  }

  function goToday(): void {
    setCurrentDate(new Date())
    setSelectedDate(null)
  }

  function goPrev(): void {
    setCurrentDate((prev) => {
      if (viewType === 'month') return subMonths(prev, 1)
      if (viewType === 'week') return subWeeks(prev, 1)
      return subDays(prev, 1)
    })
  }

  function goNext(): void {
    setCurrentDate((prev) => {
      if (viewType === 'month') return addMonths(prev, 1)
      if (viewType === 'week') return addWeeks(prev, 1)
      return addDays(prev, 1)
    })
  }

  const title = useMemo(() => {
    if (viewType === 'month') {
      return format(currentDate, 'yyyy년 M월', { locale: ko })
    }
    if (viewType === 'week') {
      const weekStart = startOfWeek(currentDate)
      const weekEnd = endOfWeek(currentDate)
      return `${format(weekStart, 'yyyy년 M월 d일', { locale: ko })} ~ ${format(weekEnd, 'M월 d일', { locale: ko })}`
    }
    return format(currentDate, 'yyyy년 M월 d일 (eee)', { locale: ko })
  }, [currentDate, viewType])

  const dateRange: ScheduleDateRange = useMemo(() => {
    if (viewType === 'month') {
      const monthStart = startOfWeek(startOfMonth(currentDate))
      const monthEnd = endOfWeek(endOfMonth(currentDate))
      return { start: monthStart, end: monthEnd }
    }
    if (viewType === 'week') {
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) }
    }
    return { start: startOfDay(currentDate), end: endOfDay(currentDate) }
  }, [currentDate, viewType])

  return {
    currentDate,
    selectedDate,
    viewType,
    setViewType,
    selectDate,
    goToday,
    goPrev,
    goNext,
    title,
    dateRange
  }
}
