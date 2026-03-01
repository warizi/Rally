import { describe, it, expect } from 'vitest'
import { getTimeSlots, timeToPosition, scheduleHeight } from '../calendar-time'

describe('getTimeSlots', () => {
  it('길이 = 18 (24 - 6)', () => {
    expect(getTimeSlots()).toHaveLength(18)
  })

  it('첫 슬롯: { hour: 6, label: "06:00" }', () => {
    expect(getTimeSlots()[0]).toEqual({ hour: 6, label: '06:00' })
  })

  it('마지막 슬롯: { hour: 23, label: "23:00" }', () => {
    const slots = getTimeSlots()
    expect(slots[slots.length - 1]).toEqual({ hour: 23, label: '23:00' })
  })
})

describe('timeToPosition', () => {
  it('06:00, hourHeight=60 → 0', () => {
    expect(timeToPosition(new Date('2026-03-02T06:00:00'), 60)).toBe(0)
  })

  it('07:00, hourHeight=60 → 60', () => {
    expect(timeToPosition(new Date('2026-03-02T07:00:00'), 60)).toBe(60)
  })

  it('06:30, hourHeight=60 → 30', () => {
    expect(timeToPosition(new Date('2026-03-02T06:30:00'), 60)).toBe(30)
  })

  it('12:00, hourHeight=60 → 360', () => {
    expect(timeToPosition(new Date('2026-03-02T12:00:00'), 60)).toBe(360)
  })

  it('음수: 03:00, hourHeight=60 → -180', () => {
    expect(timeToPosition(new Date('2026-03-02T03:00:00'), 60)).toBe(-180)
  })

  it('음수: 00:00, hourHeight=60 → -360', () => {
    expect(timeToPosition(new Date('2026-03-02T00:00:00'), 60)).toBe(-360)
  })

  it('[T-3] 최대값: 23:59, hourHeight=60', () => {
    const result = timeToPosition(new Date('2026-03-02T23:59:00'), 60)
    // (23 - 6 + 59/60) * 60 = (17 + 59/60) * 60 = 1020 + 59 = 1079
    expect(result).toBeCloseTo(1079, 0)
  })
})

describe('scheduleHeight', () => {
  it('1시간 → 60', () => {
    expect(
      scheduleHeight(new Date('2026-03-02T09:00:00'), new Date('2026-03-02T10:00:00'), 60),
    ).toBe(60)
  })

  it('30분 → 30', () => {
    expect(
      scheduleHeight(new Date('2026-03-02T09:00:00'), new Date('2026-03-02T09:30:00'), 60),
    ).toBe(30)
  })

  it('2시간 → 120', () => {
    expect(
      scheduleHeight(new Date('2026-03-02T09:00:00'), new Date('2026-03-02T11:00:00'), 60),
    ).toBe(120)
  })

  it('최소값: 19분 → Math.max(19, 20) = 20', () => {
    expect(
      scheduleHeight(new Date('2026-03-02T09:00:00'), new Date('2026-03-02T09:19:00'), 60),
    ).toBe(20)
  })

  it('최소값 정확 경계: 20분 → 20', () => {
    expect(
      scheduleHeight(new Date('2026-03-02T09:00:00'), new Date('2026-03-02T09:20:00'), 60),
    ).toBe(20)
  })

  it('최소값 초과: 21분 → 21', () => {
    expect(
      scheduleHeight(new Date('2026-03-02T09:00:00'), new Date('2026-03-02T09:21:00'), 60),
    ).toBe(21)
  })

  it('다른 hourHeight=120: 1시간 → 120', () => {
    expect(
      scheduleHeight(new Date('2026-03-02T09:00:00'), new Date('2026-03-02T10:00:00'), 120),
    ).toBe(120)
  })

  it('[T-1] 0분 (startAt === endAt) → Math.max(0, 20) = 20', () => {
    expect(
      scheduleHeight(new Date('2026-03-02T09:00:00'), new Date('2026-03-02T09:00:00'), 60),
    ).toBe(20)
  })

  it('[T-2] 음수 기간 (endAt < startAt) → Math.max(음수, 20) = 20', () => {
    expect(
      scheduleHeight(new Date('2026-03-02T10:00:00'), new Date('2026-03-02T09:00:00'), 60),
    ).toBe(20)
  })
})
