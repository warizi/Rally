import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { useCalendar } from '../use-calendar'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-15T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useCalendar', () => {
  describe('초기 상태', () => {
    it('옵션 없음 → viewType=month, selectedDate=null', () => {
      const { result } = renderHook(() => useCalendar())
      expect(result.current.viewType).toBe('month')
      expect(result.current.selectedDate).toBeNull()
    })

    it('옵션 없음 → currentDate = 고정시간', () => {
      const { result } = renderHook(() => useCalendar())
      expect(result.current.currentDate.getTime()).toBe(new Date('2026-03-15T12:00:00').getTime())
    })

    it('initialViewType=week', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'week' }))
      expect(result.current.viewType).toBe('week')
    })

    it('initialDate 지정', () => {
      const { result } = renderHook(() =>
        useCalendar({ initialDate: '2026-06-01T00:00:00' }),
      )
      expect(result.current.currentDate.getMonth()).toBe(5) // June
    })
  })

  describe('setViewType', () => {
    it('week으로 변경', () => {
      const { result } = renderHook(() => useCalendar())
      act(() => result.current.setViewType('week'))
      expect(result.current.viewType).toBe('week')
    })

    it('[UC-2] currentDate 불변: month→week 전환', () => {
      const { result } = renderHook(() => useCalendar())
      const before = result.current.currentDate.getTime()
      act(() => result.current.setViewType('week'))
      expect(result.current.currentDate.getTime()).toBe(before)
    })
  })

  describe('goPrev/goNext', () => {
    it('month: goPrev → 2월', () => {
      const { result } = renderHook(() => useCalendar())
      act(() => result.current.goPrev())
      expect(result.current.currentDate.getMonth()).toBe(1)
    })

    it('month: goNext → 4월', () => {
      const { result } = renderHook(() => useCalendar())
      act(() => result.current.goNext())
      expect(result.current.currentDate.getMonth()).toBe(3)
    })

    it('week: goPrev → 1주 전', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'week' }))
      const before = result.current.currentDate.getTime()
      act(() => result.current.goPrev())
      const diff = before - result.current.currentDate.getTime()
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000)
    })

    it('week: goNext → 1주 후', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'week' }))
      const before = result.current.currentDate.getTime()
      act(() => result.current.goNext())
      const diff = result.current.currentDate.getTime() - before
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000)
    })

    it('day: goPrev → 1일 전', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'day' }))
      act(() => result.current.goPrev())
      expect(result.current.currentDate.getDate()).toBe(14)
    })

    it('day: goNext → 1일 후', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'day' }))
      act(() => result.current.goNext())
      expect(result.current.currentDate.getDate()).toBe(16)
    })

    it('[UC-1] 왕복 검증: month goPrev→goNext → 원래 날짜', () => {
      const { result } = renderHook(() => useCalendar())
      const original = result.current.currentDate.getTime()
      act(() => result.current.goPrev())
      act(() => result.current.goNext())
      expect(result.current.currentDate.getTime()).toBe(original)
    })

    it('[UC-1] 왕복 검증: week', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'week' }))
      const original = result.current.currentDate.getTime()
      act(() => result.current.goPrev())
      act(() => result.current.goNext())
      expect(result.current.currentDate.getTime()).toBe(original)
    })

    it('[UC-1] 왕복 검증: day', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'day' }))
      const original = result.current.currentDate.getTime()
      act(() => result.current.goPrev())
      act(() => result.current.goNext())
      expect(result.current.currentDate.getTime()).toBe(original)
    })
  })

  describe('goToday', () => {
    it('이동 후 goToday → currentDate=고정시간, selectedDate=null', () => {
      const { result } = renderHook(() => useCalendar())
      act(() => result.current.goNext())
      act(() => result.current.selectDate(new Date('2026-04-10')))
      act(() => result.current.goToday())
      expect(result.current.currentDate.getTime()).toBe(new Date('2026-03-15T12:00:00').getTime())
      expect(result.current.selectedDate).toBeNull()
    })
  })

  describe('selectDate', () => {
    it('특정 날짜 → selectedDate, currentDate 둘 다 업데이트', () => {
      const { result } = renderHook(() => useCalendar())
      const target = new Date('2026-05-20')
      act(() => result.current.selectDate(target))
      expect(result.current.selectedDate!.getTime()).toBe(target.getTime())
      expect(result.current.currentDate.getTime()).toBe(target.getTime())
    })
  })

  describe('title', () => {
    it('month: "2026년 3월"', () => {
      const { result } = renderHook(() => useCalendar())
      expect(result.current.title).toBe('2026년 3월')
    })

    it('week: 주간 범위 포맷', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'week' }))
      expect(result.current.title).toContain('~')
    })

    it('day: 요일 포함 포맷', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'day' }))
      // 2026-03-15 is Sunday → (일)
      expect(result.current.title).toContain('(일)')
    })
  })

  describe('dateRange', () => {
    it('month: startOfWeek(startOfMonth) ~ endOfWeek(endOfMonth)', () => {
      const { result } = renderHook(() => useCalendar())
      const expected = {
        start: startOfWeek(startOfMonth(new Date('2026-03-15'))),
        end: endOfWeek(endOfMonth(new Date('2026-03-15'))),
      }
      expect(result.current.dateRange.start.getTime()).toBe(expected.start.getTime())
      expect(result.current.dateRange.end.getTime()).toBe(expected.end.getTime())
    })

    it('week: startOfWeek ~ endOfWeek', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'week' }))
      const cd = result.current.currentDate
      expect(result.current.dateRange.start.getTime()).toBe(startOfWeek(cd).getTime())
      expect(result.current.dateRange.end.getTime()).toBe(endOfWeek(cd).getTime())
    })

    it('day: startOfDay ~ endOfDay', () => {
      const { result } = renderHook(() => useCalendar({ initialViewType: 'day' }))
      const cd = result.current.currentDate
      expect(result.current.dateRange.start.getTime()).toBe(startOfDay(cd).getTime())
      expect(result.current.dateRange.end.getTime()).toBe(endOfDay(cd).getTime())
    })
  })
})
