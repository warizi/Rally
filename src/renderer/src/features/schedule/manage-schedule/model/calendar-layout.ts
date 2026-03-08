import { startOfDay, endOfDay, isSameDay, getDay, differenceInCalendarDays } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import type { MonthGridDay } from './calendar-grid'

// === 타입 ===

export interface WeekBarSegment {
  weekIndex: number
  startCol: number
  span: number
  isStart: boolean
  isEnd: boolean
}

export interface LayoutedSchedule {
  schedule: ScheduleItem
  column: number
  totalColumns: number
  span: number
}

export interface WeekBar {
  schedule: ScheduleItem
  startCol: number
  span: number
  isStart: boolean
  isEnd: boolean
  lane: number
}

// === 제네릭 lane 할당 ===

export function assignLanes<T extends { startCol: number; span: number }>(
  segments: (T & { schedule: ScheduleItem })[]
): (T & { schedule: ScheduleItem; lane: number })[] {
  const lanes: { endCol: number }[] = []
  const result: (T & { schedule: ScheduleItem; lane: number })[] = []

  const sorted = [...segments].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol
    return b.span - a.span
  })

  for (const item of sorted) {
    let lane = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].endCol <= item.startCol) {
        lane = i
        lanes[i].endCol = item.startCol + item.span
        break
      }
    }
    if (lane === -1) {
      lane = lanes.length
      lanes.push({ endCol: item.startCol + item.span })
    }
    result.push({ ...item, lane })
  }

  return result
}

// === 여러 날 바 분할 (월간) ===

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
      isEnd: isSameDay(effectiveEnd, schedule.endAt)
    })
  }

  return segments
}

// === 주간 바 계산 ===

export function computeWeekBars(multiDay: ScheduleItem[], weekDates: Date[]): WeekBar[] {
  const weekStart = startOfDay(weekDates[0])
  const weekEnd = endOfDay(weekDates[6])

  const items: Omit<WeekBar, 'lane'>[] = []

  for (const s of multiDay) {
    if (s.startAt > weekEnd || s.endAt < weekStart) continue

    const effectiveStart = s.startAt < weekStart ? weekStart : s.startAt
    const effectiveEnd = s.endAt > weekEnd ? weekEnd : s.endAt

    const startCol = getDay(effectiveStart)
    const span = differenceInCalendarDays(startOfDay(effectiveEnd), startOfDay(effectiveStart)) + 1

    items.push({
      schedule: s,
      startCol,
      span,
      isStart: isSameDay(effectiveStart, s.startAt),
      isEnd: isSameDay(effectiveEnd, s.endAt)
    })
  }

  const sorted = [...items].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol
    return b.span - a.span
  })

  const lanes: { endCol: number }[] = []
  const result: WeekBar[] = []

  for (const item of sorted) {
    let lane = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].endCol <= item.startCol) {
        lane = i
        lanes[i].endCol = item.startCol + item.span
        break
      }
    }
    if (lane === -1) {
      lane = lanes.length
      lanes.push({ endCol: item.startCol + item.span })
    }
    result.push({ ...item, lane })
  }

  return result
}

// === 겹침 레이아웃 (일간) ===

export function layoutOverlappingSchedules(schedules: ScheduleItem[]): LayoutedSchedule[] {
  if (schedules.length === 0) return []

  const sorted = [...schedules].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())

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
