import { describe, it, expect, vi } from 'vitest'
import { moveScheduleByDays, moveScheduleByMinutes, applyDaysDelta } from '../calendar-move'
import { makeScheduleItem } from './helpers'

describe('moveScheduleByDays', () => {
  const schedule = makeScheduleItem()

  it('+1일: startAt/endAt 모두 1일 후', () => {
    const result = moveScheduleByDays(schedule, 1)
    expect(result.startAt.getDate()).toBe(schedule.startAt.getDate() + 1)
    expect(result.endAt.getDate()).toBe(schedule.endAt.getDate() + 1)
  })

  it('-1일: 1일 전', () => {
    const result = moveScheduleByDays(schedule, -1)
    expect(result.startAt.getDate()).toBe(schedule.startAt.getDate() - 1)
    expect(result.endAt.getDate()).toBe(schedule.endAt.getDate() - 1)
  })

  it('0일: 변동 없음', () => {
    const result = moveScheduleByDays(schedule, 0)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime())
    expect(result.endAt.getTime()).toBe(schedule.endAt.getTime())
  })

  it('+7일: 1주 후', () => {
    const result = moveScheduleByDays(schedule, 7)
    expect(result.startAt.getDate()).toBe(schedule.startAt.getDate() + 7)
  })
})

describe('moveScheduleByMinutes', () => {
  const schedule = makeScheduleItem()

  it('15분 → snapped=15', () => {
    const result = moveScheduleByMinutes(schedule, 15)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime() + 15 * 60 * 1000)
  })

  it('30분 → snapped=30', () => {
    const result = moveScheduleByMinutes(schedule, 30)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime() + 30 * 60 * 1000)
  })

  it('-15분 → snapped=-15', () => {
    const result = moveScheduleByMinutes(schedule, -15)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime() - 15 * 60 * 1000)
  })

  it('7분 → Math.round(7/15)*15 = 0 (변동 없음)', () => {
    const result = moveScheduleByMinutes(schedule, 7)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime())
  })

  it('8분 → Math.round(8/15)*15 = 15', () => {
    const result = moveScheduleByMinutes(schedule, 8)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime() + 15 * 60 * 1000)
  })

  it('-7분 → 0', () => {
    const result = moveScheduleByMinutes(schedule, -7)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime())
  })

  it('-8분 → -15', () => {
    const result = moveScheduleByMinutes(schedule, -8)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime() - 15 * 60 * 1000)
  })

  it('22분 → Math.round(22/15)*15 = 15', () => {
    const result = moveScheduleByMinutes(schedule, 22)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime() + 15 * 60 * 1000)
  })

  it('23분 → Math.round(23/15)*15 = 30', () => {
    const result = moveScheduleByMinutes(schedule, 23)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime() + 30 * 60 * 1000)
  })

  it('0분 → snapped=0 (변동 없음)', () => {
    const result = moveScheduleByMinutes(schedule, 0)
    expect(result.startAt.getTime()).toBe(schedule.startAt.getTime())
  })

  it('[M-1] 기간 보존: 이동 후 duration 동일', () => {
    const original = schedule.endAt.getTime() - schedule.startAt.getTime()
    const result = moveScheduleByMinutes(schedule, 30)
    const moved = result.endAt.getTime() - result.startAt.getTime()
    expect(moved).toBe(original)
  })
})

describe('applyDaysDelta', () => {
  it('daysDelta=0 → 콜백 미호출 (early return)', () => {
    const onMoveSchedule = vi.fn()
    const onMoveTodo = vi.fn()
    applyDaysDelta(makeScheduleItem(), 0, { onMoveSchedule, onMoveTodo })
    expect(onMoveSchedule).not.toHaveBeenCalled()
    expect(onMoveTodo).not.toHaveBeenCalled()
  })

  it('일반 스케줄 + daysDelta=1 → onMoveSchedule 호출', () => {
    const onMoveSchedule = vi.fn()
    const onMoveTodo = vi.fn()
    const schedule = makeScheduleItem({ id: 'sched-1' })
    applyDaysDelta(schedule, 1, { onMoveSchedule, onMoveTodo })
    expect(onMoveSchedule).toHaveBeenCalledTimes(1)
    expect(onMoveSchedule).toHaveBeenCalledWith(
      'sched-1',
      expect.any(Date),
      expect.any(Date),
    )
    expect(onMoveTodo).not.toHaveBeenCalled()
  })

  it('todo 아이템 + daysDelta=1 → onMoveTodo 호출 (ID 슬라이싱)', () => {
    const onMoveSchedule = vi.fn()
    const onMoveTodo = vi.fn()
    const schedule = makeScheduleItem({ id: 'todo:abc123' })
    applyDaysDelta(schedule, 1, { onMoveSchedule, onMoveTodo })
    expect(onMoveTodo).toHaveBeenCalledTimes(1)
    expect(onMoveTodo).toHaveBeenCalledWith(
      'abc123', // slice(5)
      expect.any(Date),
      expect.any(Date),
    )
    expect(onMoveSchedule).not.toHaveBeenCalled()
  })

  it('콜백에 전달된 startAt/endAt이 moveScheduleByDays 결과와 일치', () => {
    const onMoveSchedule = vi.fn()
    const onMoveTodo = vi.fn()
    const schedule = makeScheduleItem()
    applyDaysDelta(schedule, 3, { onMoveSchedule, onMoveTodo })
    const { startAt, endAt } = moveScheduleByDays(schedule, 3)
    expect(onMoveSchedule).toHaveBeenCalledWith(schedule.id, startAt, endAt)
  })
})
