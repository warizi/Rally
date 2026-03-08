import { describe, it, expect } from 'vitest'
import { isTodoItem, isScheduleOnDate } from '../calendar-predicates'
import { makeScheduleItem } from './helpers'

describe('isTodoItem', () => {
  it('todo: 접두사 → true', () => {
    expect(isTodoItem(makeScheduleItem({ id: 'todo:abc123' }))).toBe(true)
  })

  it('일반 스케줄 id → false', () => {
    expect(isTodoItem(makeScheduleItem({ id: 'sched-1' }))).toBe(false)
  })

  it('todo: 접두사만 (값 없음) → true', () => {
    expect(isTodoItem(makeScheduleItem({ id: 'todo:' }))).toBe(true)
  })

  it('대문자 TODO: → false (대소문자 구분)', () => {
    expect(isTodoItem(makeScheduleItem({ id: 'TODO:abc' }))).toBe(false)
  })
})

describe('isScheduleOnDate', () => {
  it('당일 내 시작/종료 → true', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00')
    })
    expect(isScheduleOnDate(schedule, new Date('2026-03-02'))).toBe(true)
  })

  it('여러 날 걸쳐 당일 포함 → true', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-01T09:00:00'),
      endAt: new Date('2026-03-05T10:00:00')
    })
    expect(isScheduleOnDate(schedule, new Date('2026-03-03'))).toBe(true)
  })

  it('완전히 이전 날 → false', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00')
    })
    expect(isScheduleOnDate(schedule, new Date('2026-03-01'))).toBe(false)
  })

  it('완전히 이후 날 → false', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-02T09:00:00'),
      endAt: new Date('2026-03-02T10:00:00')
    })
    expect(isScheduleOnDate(schedule, new Date('2026-03-03'))).toBe(false)
  })

  it('경계: startAt이 정확히 dayEnd와 같을 때 → true', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-02T23:59:59.999'),
      endAt: new Date('2026-03-03T10:00:00')
    })
    expect(isScheduleOnDate(schedule, new Date('2026-03-02'))).toBe(true)
  })

  it('경계: endAt이 정확히 dayStart와 같을 때 → true', () => {
    const schedule = makeScheduleItem({
      startAt: new Date('2026-03-01T09:00:00'),
      endAt: new Date('2026-03-02T00:00:00.000')
    })
    expect(isScheduleOnDate(schedule, new Date('2026-03-02'))).toBe(true)
  })
})
