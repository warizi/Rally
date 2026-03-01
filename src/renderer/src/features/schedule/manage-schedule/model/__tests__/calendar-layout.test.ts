import { describe, it, expect } from 'vitest'
import { addDays, startOfDay } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import type { MonthGridDay } from '../calendar-grid'
import {
  assignLanes,
  splitBarByWeeks,
  computeWeekBars,
  layoutOverlappingSchedules,
} from '../calendar-layout'
import { makeScheduleItem } from './helpers'

// ─── helpers ───

function makeSegment(
  startCol: number,
  span: number,
  schedule?: ScheduleItem,
) {
  return { startCol, span, schedule: schedule ?? makeScheduleItem() }
}

function makeWeekRow(startDate: Date, month: number): MonthGridDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startDate, i)
    return { date, isCurrentMonth: date.getMonth() === month, isToday: false }
  })
}

function makeGrid(baseDate: Date, month: number, weekCount: number): MonthGridDay[][] {
  const weeks: MonthGridDay[][] = []
  let cursor = startOfDay(baseDate)
  for (let w = 0; w < weekCount; w++) {
    weeks.push(makeWeekRow(cursor, month))
    cursor = addDays(cursor, 7)
  }
  return weeks
}

function makeWeekDates(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startOfDay(start), i))
}

// ─── assignLanes ───

describe('assignLanes', () => {
  it('빈 배열 → 빈 배열', () => {
    expect(assignLanes([])).toEqual([])
  })

  it('단일 세그먼트 → lane=0', () => {
    const result = assignLanes([makeSegment(0, 2)])
    expect(result).toHaveLength(1)
    expect(result[0].lane).toBe(0)
  })

  it('겹치지 않는 2개 → 같은 lane 재사용', () => {
    const result = assignLanes([makeSegment(0, 2), makeSegment(3, 1)])
    expect(result[0].lane).toBe(0)
    expect(result[1].lane).toBe(0)
  })

  it('겹치는 2개 → 다른 lane', () => {
    const result = assignLanes([makeSegment(0, 3), makeSegment(1, 2)])
    const lanes = result.map((r) => r.lane)
    expect(new Set(lanes).size).toBe(2)
  })

  it('정렬: 같은 startCol일 때 span 큰 것이 먼저', () => {
    const result = assignLanes([makeSegment(0, 1), makeSegment(0, 3)])
    const bigSpan = result.find((r) => r.span === 3)!
    const smallSpan = result.find((r) => r.span === 1)!
    expect(bigSpan.lane).toBeLessThan(smallSpan.lane)
  })

  it('3개 이상 겹침 → lane 0, 1, 2', () => {
    const result = assignLanes([
      makeSegment(0, 3),
      makeSegment(0, 3),
      makeSegment(0, 3),
    ])
    const lanes = result.map((r) => r.lane).sort()
    expect(lanes).toEqual([0, 1, 2])
  })

  it('[L-1] endCol === startCol 경계: 같은 lane 재사용', () => {
    // A(col=0, span=2) → endCol=2, B(col=2, span=1) → lanes[0].endCol(2) <= 2 → true
    const result = assignLanes([makeSegment(0, 2), makeSegment(2, 1)])
    expect(result[0].lane).toBe(0)
    expect(result[1].lane).toBe(0)
  })

  it('[L-2] lane 0이 아닌 lane 1 재사용', () => {
    // A(col=0, span=5)→lane0, B(col=0, span=2)→lane1, C(col=3, span=1)→lane1 재사용
    const result = assignLanes([
      makeSegment(0, 5),
      makeSegment(0, 2),
      makeSegment(3, 1),
    ])
    const a = result.find((r) => r.span === 5)!
    const b = result.find((r) => r.span === 2 && r.startCol === 0)!
    const c = result.find((r) => r.span === 1 && r.startCol === 3)!
    expect(a.lane).toBe(0)
    expect(b.lane).toBe(1)
    expect(c.lane).toBe(1) // lane1 재사용 (endCol=2 <= 3)
  })
})

// ─── splitBarByWeeks ───

describe('splitBarByWeeks', () => {
  // 2026-03: Sunday 3/1 starts the grid
  // Build a manual 5-week grid for March 2026
  const monthGrid = makeGrid(new Date('2026-03-01'), 2, 5)

  it('단일 주 내 1일 스케줄 → segments 1개', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-03T09:00:00'), // Tuesday
      endAt: new Date('2026-03-03T17:00:00'),
    })
    const segments = splitBarByWeeks(schedule, monthGrid)
    expect(segments).toHaveLength(1)
    expect(segments[0].isStart).toBe(true)
    expect(segments[0].isEnd).toBe(true)
    expect(segments[0].span).toBe(1)
  })

  it('단일 주 내 3일 스케줄 → span=3', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-02T09:00:00'), // Monday
      endAt: new Date('2026-03-04T17:00:00'), // Wednesday
    })
    const segments = splitBarByWeeks(schedule, monthGrid)
    expect(segments).toHaveLength(1)
    expect(segments[0].span).toBe(3)
  })

  it('2주에 걸친 스케줄 → segments 2개', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-06T09:00:00'), // Friday week0
      endAt: new Date('2026-03-09T17:00:00'), // Monday week1
    })
    const segments = splitBarByWeeks(schedule, monthGrid)
    expect(segments).toHaveLength(2)
    expect(segments[0].isEnd).toBe(false)
    expect(segments[1].isStart).toBe(false)
  })

  it('3주에 걸친 스케줄 → segments 3개, 중간은 isStart/isEnd=false', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-05T09:00:00'), // Thursday week0
      endAt: new Date('2026-03-16T17:00:00'), // Monday week2
    })
    const segments = splitBarByWeeks(schedule, monthGrid)
    expect(segments).toHaveLength(3)
    expect(segments[1].isStart).toBe(false)
    expect(segments[1].isEnd).toBe(false)
  })

  it('monthGrid 범위 밖 → 빈 배열', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-04-10T09:00:00'),
      endAt: new Date('2026-04-11T17:00:00'),
    })
    const segments = splitBarByWeeks(schedule, monthGrid)
    expect(segments).toEqual([])
  })

  it('스케줄이 monthGrid 시작 전부터 → 첫 segment startCol=0', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-02-25T09:00:00'),
      endAt: new Date('2026-03-03T17:00:00'),
    })
    const segments = splitBarByWeeks(schedule, monthGrid)
    expect(segments[0].startCol).toBe(0)
  })

  it('스케줄이 monthGrid 끝 이후까지 → 마지막 segment 토요일까지', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-28T09:00:00'),
      endAt: new Date('2026-04-10T17:00:00'),
    })
    const segments = splitBarByWeeks(schedule, monthGrid)
    const last = segments[segments.length - 1]
    expect(last.startCol + last.span).toBeLessThanOrEqual(7)
  })

  it('[L-3] 경계: schedule.startAt === weekEnd → 포함됨', () => {
    // week0 ends Saturday 2026-03-07 23:59:59.999
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-07T23:59:59.999'),
      endAt: new Date('2026-03-08T17:00:00'),
    })
    const segments = splitBarByWeeks(schedule, monthGrid)
    // Should be included in week0 (startAt <= weekEnd)
    const week0Seg = segments.find((s) => s.weekIndex === 0)
    expect(week0Seg).toBeDefined()
  })

  it('[L-4] 경계: schedule.endAt === weekStart → 포함됨', () => {
    // week1 starts Sunday 2026-03-08 00:00:00.000
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-05T09:00:00'),
      endAt: new Date('2026-03-08T00:00:00.000'),
    })
    const segments = splitBarByWeeks(schedule, monthGrid)
    const week1Seg = segments.find((s) => s.weekIndex === 1)
    expect(week1Seg).toBeDefined()
  })
})

// ─── computeWeekBars ───

describe('computeWeekBars', () => {
  // Week of 2026-03-08 (Sun) ~ 2026-03-14 (Sat)
  const weekDates = makeWeekDates(new Date('2026-03-08'))

  it('빈 배열 → 빈 배열', () => {
    expect(computeWeekBars([], weekDates)).toEqual([])
  })

  it('주간 범위 밖 스케줄 → 필터링', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-01T09:00:00'),
      endAt: new Date('2026-03-01T17:00:00'),
    })
    expect(computeWeekBars([schedule], weekDates)).toEqual([])
  })

  it('주간 내 2일 스케줄 → span=2', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-09T09:00:00'), // Monday
      endAt: new Date('2026-03-10T17:00:00'), // Tuesday
    })
    const bars = computeWeekBars([schedule], weekDates)
    expect(bars).toHaveLength(1)
    expect(bars[0].span).toBe(2)
    expect(bars[0].isStart).toBe(true)
    expect(bars[0].isEnd).toBe(true)
  })

  it('주간 시작 전부터 → isStart=false, startCol=0', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-06T09:00:00'), // Before the week
      endAt: new Date('2026-03-10T17:00:00'),
    })
    const bars = computeWeekBars([schedule], weekDates)
    expect(bars[0].isStart).toBe(false)
    expect(bars[0].startCol).toBe(0)
  })

  it('주간 끝 이후까지 → isEnd=false', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-12T09:00:00'),
      endAt: new Date('2026-03-18T17:00:00'), // After the week
    })
    const bars = computeWeekBars([schedule], weekDates)
    expect(bars[0].isEnd).toBe(false)
  })

  it('겹치는 2개 → 다른 lane', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-09T09:00:00'),
      endAt: new Date('2026-03-11T17:00:00'),
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-10T09:00:00'),
      endAt: new Date('2026-03-12T17:00:00'),
    })
    const bars = computeWeekBars([a, b], weekDates)
    expect(bars).toHaveLength(2)
    const lanes = bars.map((b) => b.lane)
    expect(new Set(lanes).size).toBe(2)
  })

  it('[L-8] 같은 날 시작/종료 → span=1', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-10T09:00:00'),
      endAt: new Date('2026-03-10T17:00:00'),
    })
    const bars = computeWeekBars([schedule], weekDates)
    expect(bars[0].span).toBe(1)
  })

  it('같은 startCol, 다른 span → span 큰 것이 먼저 정렬 (tiebreaker)', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-09T09:00:00'), // Monday
      endAt: new Date('2026-03-09T17:00:00'), // same day → span=1
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-09T09:00:00'), // Monday
      endAt: new Date('2026-03-11T17:00:00'), // Wednesday → span=3
    })
    const bars = computeWeekBars([a, b], weekDates)
    expect(bars).toHaveLength(2)
    const bigSpan = bars.find((b) => b.schedule.id === 'b')!
    const smallSpan = bars.find((b) => b.schedule.id === 'a')!
    expect(bigSpan.lane).toBeLessThanOrEqual(smallSpan.lane)
  })

  it('겹치지 않는 2개 → 같은 lane 재사용', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-08T09:00:00'), // Sunday
      endAt: new Date('2026-03-09T17:00:00'), // Monday → span=2
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-11T09:00:00'), // Wednesday
      endAt: new Date('2026-03-12T17:00:00'), // Thursday → span=2
    })
    const bars = computeWeekBars([a, b], weekDates)
    expect(bars).toHaveLength(2)
    expect(bars[0].lane).toBe(0)
    expect(bars[1].lane).toBe(0) // lane 재사용
  })
})

// ─── layoutOverlappingSchedules ───

describe('layoutOverlappingSchedules', () => {
  it('빈 배열 → 빈 배열', () => {
    expect(layoutOverlappingSchedules([])).toEqual([])
  })

  it('단일 스케줄 → column:0, totalColumns:1, span:1', () => {
    const result = layoutOverlappingSchedules([makeScheduleItem()])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ column: 0, totalColumns: 1, span: 1 })
  })

  it('겹치지 않는 2개 → 같은 column 재사용, 독립 클러스터', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00'),
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-02T11:00:00'),
      endAt: new Date('2026-03-02T12:00:00'),
    })
    const result = layoutOverlappingSchedules([a, b])
    expect(result[0].column).toBe(0)
    expect(result[1].column).toBe(0)
    expect(result[0].totalColumns).toBe(1)
    expect(result[1].totalColumns).toBe(1)
  })

  it('[L-6] 인접: A.endAt === B.startAt → 같은 col, 독립 클러스터', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00'),
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-02T10:00:00'),
      endAt: new Date('2026-03-02T11:00:00'),
    })
    const result = layoutOverlappingSchedules([a, b])
    // Phase1: B.startAt(10:00) >= columnEnds[0](10:00) → true → same col
    expect(result[0].column).toBe(0)
    expect(result[1].column).toBe(0)
    // Phase2: B.startAt(10:00) < A.endAt(10:00) → false → not overlapping
    expect(result[0].totalColumns).toBe(1)
    expect(result[1].totalColumns).toBe(1)
  })

  it('2개 겹침 → column 0,1, totalColumns=2', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T11:00:00'),
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-02T10:00:00'),
      endAt: new Date('2026-03-02T12:00:00'),
    })
    const result = layoutOverlappingSchedules([a, b])
    expect(result[0].column).toBe(0)
    expect(result[1].column).toBe(1)
    expect(result[0].totalColumns).toBe(2)
    expect(result[1].totalColumns).toBe(2)
  })

  it('3개 체인 겹침 (A-B 겹침, B-C 겹침, A-C 안겹침) → 같은 클러스터', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00'),
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-02T09:30:00'),
      endAt: new Date('2026-03-02T11:00:00'),
    })
    const c = makeScheduleItem({
      id: 'c',
      startAt: new Date('2026-03-02T10:30:00'),
      endAt: new Date('2026-03-02T12:00:00'),
    })
    const result = layoutOverlappingSchedules([a, b, c])
    // All in same cluster via chain: A-B overlap, B-C overlap
    const totalCols = result.map((r) => r.totalColumns)
    expect(new Set(totalCols).size).toBe(1) // all same totalColumns
  })

  it('[L-7] 동일 startAt 복수 스케줄', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T11:00:00'),
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00'),
    })
    const result = layoutOverlappingSchedules([a, b])
    const cols = result.map((r) => r.column)
    expect(new Set(cols).size).toBe(2) // different columns
  })

  it('2개 독립 클러스터', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00'),
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00'),
    })
    const c = makeScheduleItem({
      id: 'c',
      startAt: new Date('2026-03-02T14:00:00'),
      endAt: new Date('2026-03-02T15:00:00'),
    })
    const d = makeScheduleItem({
      id: 'd',
      startAt: new Date('2026-03-02T14:00:00'),
      endAt: new Date('2026-03-02T15:00:00'),
    })
    const result = layoutOverlappingSchedules([a, b, c, d])
    const cluster1 = result.filter((r) => r.schedule.id === 'a' || r.schedule.id === 'b')
    const cluster2 = result.filter((r) => r.schedule.id === 'c' || r.schedule.id === 'd')
    expect(cluster1[0].totalColumns).toBe(2)
    expect(cluster2[0].totalColumns).toBe(2)
  })

  it('[L-5] span=2 구체 케이스: A(9-10), B(9-10), C(9-11), D(10:30-11)', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00'),
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00'),
    })
    const c = makeScheduleItem({
      id: 'c',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T11:00:00'),
    })
    const d = makeScheduleItem({
      id: 'd',
      startAt: new Date('2026-03-02T10:30:00'),
      endAt: new Date('2026-03-02T11:00:00'),
    })
    const result = layoutOverlappingSchedules([a, b, c, d])
    const dResult = result.find((r) => r.schedule.id === 'd')!
    expect(dResult.span).toBe(2)
    expect(dResult.totalColumns).toBe(3)
  })

  it('span 확장 불가 (오른쪽 열 점유) → span=1 유지', () => {
    const a = makeScheduleItem({
      id: 'a',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T11:00:00'),
    })
    const b = makeScheduleItem({
      id: 'b',
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T11:00:00'),
    })
    const result = layoutOverlappingSchedules([a, b])
    // Both overlap fully → each has span=1
    expect(result[0].span).toBe(1)
    expect(result[1].span).toBe(1)
  })
})
