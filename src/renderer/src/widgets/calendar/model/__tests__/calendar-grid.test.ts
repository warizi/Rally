import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getMonthGrid, getWeekDates } from '../calendar-grid'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-15T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('getMonthGrid', () => {
  it('3월: 각 주 7일, 총 5주', () => {
    const grid = getMonthGrid(2026, 2) // 0-indexed: 2 = 3월
    expect(grid.length).toBe(5)
    for (const week of grid) {
      expect(week).toHaveLength(7)
    }
  })

  it('2026년 2월 (1일이 일요일): 첫 주에 패딩 없음', () => {
    const grid = getMonthGrid(2026, 1) // 0-indexed: 1 = 2월
    // 2026-02-01 is Sunday → first cell should be Feb 1
    expect(grid[0][0].date.getDate()).toBe(1)
    expect(grid[0][0].date.getMonth()).toBe(1)
    expect(grid[0][0].isCurrentMonth).toBe(true)
  })

  it('2025년 11월 (1일이 토요일): 6주 그리드 생성', () => {
    const grid = getMonthGrid(2025, 10) // 0-indexed: 10 = 11월
    expect(grid.length).toBe(6)
  })

  it('isCurrentMonth: 3월 날짜만 true, 패딩은 false', () => {
    const grid = getMonthGrid(2026, 2)
    for (const week of grid) {
      for (const day of week) {
        if (day.date.getMonth() === 2) {
          expect(day.isCurrentMonth).toBe(true)
        } else {
          expect(day.isCurrentMonth).toBe(false)
        }
      }
    }
  })

  it('isToday: 고정시간 3월 15일만 true', () => {
    const grid = getMonthGrid(2026, 2)
    for (const week of grid) {
      for (const day of week) {
        if (day.date.getDate() === 15 && day.date.getMonth() === 2) {
          expect(day.isToday).toBe(true)
        } else {
          expect(day.isToday).toBe(false)
        }
      }
    }
  })

  it('[G-2] isToday 패딩 영역: 3월 29일에 고정 후 4월 뷰', () => {
    // April 2026 starts on Wednesday → grid starts Sunday March 29
    vi.setSystemTime(new Date('2026-03-29T12:00:00'))
    const grid = getMonthGrid(2026, 3) // 4월 뷰 (0-indexed: 3 = 4월)
    // 패딩 영역의 3월 29일 셀이 isToday=true
    const mar29 = grid.flat().find((d) => d.date.getDate() === 29 && d.date.getMonth() === 2)
    expect(mar29).toBeDefined()
    expect(mar29!.isToday).toBe(true)
    expect(mar29!.isCurrentMonth).toBe(false)
  })

  it('[G-3] 윤년: 2024년 2월 (29일까지)', () => {
    const grid = getMonthGrid(2024, 1) // 2024년 2월
    const allDates = grid.flat().filter((d) => d.isCurrentMonth)
    expect(allDates).toHaveLength(29)
  })

  it('[G-3] 12월 경계: 다음해 1월 패딩', () => {
    const grid = getMonthGrid(2026, 11) // 12월
    const lastWeek = grid[grid.length - 1]
    const janPadding = lastWeek.filter((d) => d.date.getMonth() === 0)
    for (const d of janPadding) {
      expect(d.isCurrentMonth).toBe(false)
    }
  })

  it('속성 기반: 모든 날짜 연속, 첫 날은 일요일', () => {
    const grid = getMonthGrid(2026, 2)
    const allDates = grid.flat()
    // 첫 날은 일요일
    expect(allDates[0].date.getDay()).toBe(0)
    // 날짜 연속 검증
    for (let i = 1; i < allDates.length; i++) {
      const diff = allDates[i].date.getTime() - allDates[i - 1].date.getTime()
      expect(diff).toBe(24 * 60 * 60 * 1000)
    }
  })
})

describe('getWeekDates', () => {
  it('7개 날짜 반환', () => {
    const dates = getWeekDates(new Date('2026-03-15'))
    expect(dates).toHaveLength(7)
  })

  it('첫 날이 일요일', () => {
    const dates = getWeekDates(new Date('2026-03-15'))
    expect(dates[0].getDay()).toBe(0)
  })

  it('날짜가 연속적 (각 차이 = 1일)', () => {
    const dates = getWeekDates(new Date('2026-03-15'))
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i].getTime() - dates[i - 1].getTime()
      expect(diff).toBe(24 * 60 * 60 * 1000)
    }
  })

  it('수요일 입력 → 해당 주 일요일~토요일', () => {
    // 2026-03-18 is Wednesday
    const dates = getWeekDates(new Date('2026-03-18'))
    expect(dates[0].getDay()).toBe(0) // Sunday
    expect(dates[6].getDay()).toBe(6) // Saturday
    expect(dates[0].getDate()).toBe(15) // 2026-03-15 Sunday
    expect(dates[6].getDate()).toBe(21) // 2026-03-21 Saturday
  })
})
