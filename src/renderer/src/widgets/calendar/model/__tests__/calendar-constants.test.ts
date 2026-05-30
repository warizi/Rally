/**
 * widgets/calendar/model/calendar-constants.test.ts
 */
import { describe, it, expect } from 'vitest'
import {
  WEEKDAY_LABELS,
  MONTH_BAR_HEIGHT,
  WEEK_BAR_HEIGHT,
  BAR_GAP,
  HOUR_HEIGHT,
  DEFAULT_START_HOUR,
  DEFAULT_END_HOUR,
  DND_ACTIVATION_CONSTRAINT
} from '../calendar-constants'

describe('WEEKDAY_LABELS', () => {
  it('7개 한글 요일 라벨', () => {
    expect(WEEKDAY_LABELS).toEqual(['일', '월', '화', '수', '목', '금', '토'])
  })
})

describe('계산 상수', () => {
  it('MONTH_BAR_HEIGHT=18, WEEK_BAR_HEIGHT=20, BAR_GAP=2, HOUR_HEIGHT=60', () => {
    expect(MONTH_BAR_HEIGHT).toBe(18)
    expect(WEEK_BAR_HEIGHT).toBe(20)
    expect(BAR_GAP).toBe(2)
    expect(HOUR_HEIGHT).toBe(60)
  })

  it('DEFAULT_START_HOUR=6 < DEFAULT_END_HOUR=24', () => {
    expect(DEFAULT_START_HOUR).toBe(6)
    expect(DEFAULT_END_HOUR).toBe(24)
    expect(DEFAULT_START_HOUR).toBeLessThan(DEFAULT_END_HOUR)
  })
})

describe('DND_ACTIVATION_CONSTRAINT', () => {
  it('delay 200ms + tolerance 5px', () => {
    expect(DND_ACTIVATION_CONSTRAINT).toEqual({ delay: 200, tolerance: 5 })
  })
})
