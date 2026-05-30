/**
 * widgets/calendar/model/calendar-utils.test.ts — barrel re-export 검증.
 */
import { describe, it, expect } from 'vitest'
import * as utils from '../calendar-utils'

describe('calendar-utils barrel', () => {
  it('상수 re-export — DEFAULT_START_HOUR / DEFAULT_END_HOUR', () => {
    expect(utils.DEFAULT_START_HOUR).toBe(6)
    expect(utils.DEFAULT_END_HOUR).toBe(24)
  })

  it('predicate 함수 re-export', () => {
    expect(typeof utils.isTodoItem).toBe('function')
    expect(typeof utils.isScheduleOnDate).toBe('function')
  })

  it('grid 함수 re-export', () => {
    expect(typeof utils.getMonthGrid).toBe('function')
    expect(typeof utils.getWeekDates).toBe('function')
  })

  it('time 함수 re-export', () => {
    expect(typeof utils.getTimeSlots).toBe('function')
    expect(typeof utils.timeToPosition).toBe('function')
    expect(typeof utils.scheduleHeight).toBe('function')
  })

  it('layout 함수 re-export', () => {
    expect(typeof utils.splitBarByWeeks).toBe('function')
    expect(typeof utils.layoutOverlappingSchedules).toBe('function')
  })

  it('move 함수 re-export', () => {
    expect(typeof utils.moveScheduleByDays).toBe('function')
    expect(typeof utils.moveScheduleByMinutes).toBe('function')
  })
})
