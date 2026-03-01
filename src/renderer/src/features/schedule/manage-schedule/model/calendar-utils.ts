import {
  addDays,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  isSameDay,
  differenceInMinutes,
  getDay,
} from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'

// === 타입 ===

export interface MonthGridDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
}

export interface TimeSlot {
  hour: number
  label: string
}

export interface LayoutedSchedule {
  schedule: ScheduleItem
  column: number
  totalColumns: number
  span: number
}

export interface WeekBarSegment {
  weekIndex: number
  startCol: number
  span: number
  isStart: boolean
  isEnd: boolean
}

// === 월간 그리드 ===

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
        isToday: isSameDay(current, today),
      })
      current = addDays(current, 1)
    }
    weeks.push(week)
  }

  return weeks
}

// === 주간 ===

export function getWeekDates(date: Date): Date[] {
  const weekStart = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

// === 시간 ===

export const START_HOUR = 6

export function getTimeSlots(): TimeSlot[] {
  return Array.from({ length: 24 - START_HOUR }, (_, i) => ({
    hour: START_HOUR + i,
    label: `${String(START_HOUR + i).padStart(2, '0')}:00`,
  }))
}

export function timeToPosition(date: Date, hourHeight: number): number {
  return (date.getHours() - START_HOUR + date.getMinutes() / 60) * hourHeight
}

export function scheduleHeight(startAt: Date, endAt: Date, hourHeight: number): number {
  return Math.max((differenceInMinutes(endAt, startAt) / 60) * hourHeight, 20)
}

// === 날짜 비교 ===

export function isScheduleOnDate(schedule: ScheduleItem, date: Date): boolean {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  return schedule.startAt <= dayEnd && schedule.endAt >= dayStart
}

// === 여러 날 바 분할 ===

export function splitBarByWeeks(
  schedule: ScheduleItem,
  monthGrid: MonthGridDay[][]
): WeekBarSegment[] {
  const segments: WeekBarSegment[] = []

  for (let weekIdx = 0; weekIdx < monthGrid.length; weekIdx++) {
    const week = monthGrid[weekIdx]
    const weekStart = startOfDay(week[0].date)
    const weekEnd = endOfDay(week[6].date)

    if (schedule.startAt > weekEnd || schedule.endAt < weekStart) continue

    const effectiveStart = schedule.startAt < weekStart ? weekStart : schedule.startAt
    const effectiveEnd = schedule.endAt > weekEnd ? weekEnd : schedule.endAt

    const startCol = getDay(effectiveStart)
    const daysDiff = Math.floor(
      (startOfDay(effectiveEnd).getTime() - startOfDay(effectiveStart).getTime()) /
        (1000 * 60 * 60 * 24)
    )

    segments.push({
      weekIndex: weekIdx,
      startCol,
      span: daysDiff + 1,
      isStart: isSameDay(effectiveStart, schedule.startAt),
      isEnd: isSameDay(effectiveEnd, schedule.endAt),
    })
  }

  return segments
}

// === 겹침 레이아웃 (일간/주간) ===

export function layoutOverlappingSchedules(
  schedules: ScheduleItem[]
): LayoutedSchedule[] {
  if (schedules.length === 0) return []

  const sorted = [...schedules].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime()
  )

  // 1) 열 할당: greedy — 겹치지 않는 스케줄은 같은 열 재사용
  const assigned: { schedule: ScheduleItem; column: number }[] = []
  const columnEnds: Date[] = []

  for (const schedule of sorted) {
    let col = -1
    for (let i = 0; i < columnEnds.length; i++) {
      if (schedule.startAt >= columnEnds[i]) {
        col = i
        columnEnds[i] = schedule.endAt
        break
      }
    }
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(schedule.endAt)
    }
    assigned.push({ schedule, column: col })
  }

  const n = assigned.length

  // 2) 클러스터(연결 요소) 구성 — 겹치는 스케줄끼리 같은 그룹
  const parent = Array.from({ length: n }, (_, i) => i)
  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x])
    return parent[x]
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (
        assigned[i].schedule.startAt < assigned[j].schedule.endAt &&
        assigned[j].schedule.startAt < assigned[i].schedule.endAt
      ) {
        parent[find(i)] = find(j)
      }
    }
  }

  // 3) 클러스터별 최대 열 → totalColumns
  const clusterMaxCol = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    const cur = clusterMaxCol.get(root) ?? 0
    if (assigned[i].column > cur) clusterMaxCol.set(root, assigned[i].column)
  }

  // 4) 각 스케줄의 span: 오른쪽 빈 열로 확장
  return assigned.map(({ schedule, column }, idx) => {
    const totalColumns = (clusterMaxCol.get(find(idx)) ?? 0) + 1

    let span = 1
    for (let nextCol = column + 1; nextCol < totalColumns; nextCol++) {
      let occupied = false
      for (let j = 0; j < n; j++) {
        if (j === idx) continue
        if (
          assigned[j].column === nextCol &&
          assigned[j].schedule.startAt < schedule.endAt &&
          schedule.startAt < assigned[j].schedule.endAt
        ) {
          occupied = true
          break
        }
      }
      if (occupied) break
      span++
    }

    return { schedule, column, totalColumns, span }
  })
}

// === DnD 유틸 ===

export function moveScheduleByDays(
  schedule: ScheduleItem,
  daysDelta: number
): { startAt: Date; endAt: Date } {
  return {
    startAt: addDays(schedule.startAt, daysDelta),
    endAt: addDays(schedule.endAt, daysDelta),
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
    endAt: new Date(schedule.endAt.getTime() + msOffset),
  }
}
