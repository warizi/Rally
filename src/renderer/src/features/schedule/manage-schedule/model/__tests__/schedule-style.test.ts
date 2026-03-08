import { describe, it, expect } from 'vitest'
import { getItemStyle, getItemDotStyle } from '../schedule-style'
import { makeScheduleItem } from './helpers'

describe('getItemStyle', () => {
  it('일반 스케줄 → backgroundColor with alpha, border undefined', () => {
    const schedule = makeScheduleItem({ id: 'sched-1', color: null })
    const style = getItemStyle(schedule)
    expect(style.backgroundColor).toBe('#6b728020')
    expect(style.border).toBeUndefined()
  })

  it('todo 아이템 → transparent bg, border with alpha', () => {
    const schedule = makeScheduleItem({ id: 'todo:xxx', color: null })
    const style = getItemStyle(schedule)
    expect(style.backgroundColor).toBe('#6b728008')
    expect(style.border).toBe('1.5px dashed #6b728040')
  })

  it('[S-1] backgroundColor 항상 반환: todo와 non-todo 모두', () => {
    const regular = getItemStyle(makeScheduleItem({ id: 'sched-1' }))
    const todo = getItemStyle(makeScheduleItem({ id: 'todo:x' }))
    expect(regular.backgroundColor).toBeDefined()
    expect(todo.backgroundColor).toBeDefined()
  })

  it('커스텀 색상 hex 연결 정확성', () => {
    const schedule = makeScheduleItem({ id: 'sched-1', color: '#ff0000' })
    const style = getItemStyle(schedule)
    expect(style.backgroundColor).toBe('#ff000020')

    const todoSchedule = makeScheduleItem({ id: 'todo:x', color: '#ff0000' })
    const todoStyle = getItemStyle(todoSchedule)
    expect(todoStyle.border).toBe('1.5px dashed #ff000040')
  })
})

describe('getItemDotStyle', () => {
  it('일반 스케줄 → backgroundColor=color, border undefined', () => {
    const schedule = makeScheduleItem({ id: 'sched-1', color: null })
    const style = getItemDotStyle(schedule)
    expect(style.backgroundColor).toBe('#6b7280')
    expect(style.border).toBeUndefined()
  })

  it('todo 아이템 → transparent bg, border with solid color', () => {
    const schedule = makeScheduleItem({ id: 'todo:xxx', color: null })
    const style = getItemDotStyle(schedule)
    expect(style.backgroundColor).toBe('transparent')
    expect(style.border).toBe('1.5px solid #6b7280')
  })
})
