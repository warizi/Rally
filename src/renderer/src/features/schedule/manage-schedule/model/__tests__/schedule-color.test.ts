import { describe, it, expect } from 'vitest'
import { getScheduleColor } from '../schedule-color'
import { makeScheduleItem } from './helpers'
import type { SchedulePriority } from '@entities/schedule'

describe('getScheduleColor', () => {
  it('color 지정 시 color 우선', () => {
    const schedule = makeScheduleItem({ color: '#ff0000', priority: 'medium' as SchedulePriority })
    expect(getScheduleColor(schedule)).toBe('#ff0000')
  })

  it('color=null, priority=high → #ef4444', () => {
    const schedule = makeScheduleItem({ color: null, priority: 'high' as SchedulePriority })
    expect(getScheduleColor(schedule)).toBe('#ef4444')
  })

  it('color=null, priority=medium → #3b82f6', () => {
    const schedule = makeScheduleItem({ color: null, priority: 'medium' as SchedulePriority })
    expect(getScheduleColor(schedule)).toBe('#3b82f6')
  })

  it('color=null, priority=low → #6b7280', () => {
    const schedule = makeScheduleItem({ color: null, priority: 'low' as SchedulePriority })
    expect(getScheduleColor(schedule)).toBe('#6b7280')
  })
})
