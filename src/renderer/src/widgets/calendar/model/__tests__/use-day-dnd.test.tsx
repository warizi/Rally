/**
 * widgets/calendar/model/use-day-dnd.test.tsx
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import { useDayDnd } from '../use-day-dnd'
import type { ScheduleItem } from '@entities/schedule'

function makeSchedule(id: string, isTodo = false): ScheduleItem {
  return {
    id: isTodo ? `todo:${id}` : id,
    workspaceId: 'ws1',
    title: 'T',
    description: null,
    location: null,
    allDay: false,
    startAt: new Date('2026-05-30T09:00:00.000Z'),
    endAt: new Date('2026-05-30T10:00:00.000Z'),
    color: null,
    createdAt: new Date(),
    updatedAt: new Date()
  } as unknown as ScheduleItem
}

function baseOptions(): Parameters<typeof useDayDnd>[0] {
  return {
    workspaceId: 'ws1',
    hourHeight: 60,
    clampMap: new Map(),
    onMoveSchedule: vi.fn(),
    onMoveTodo: vi.fn()
  }
}

describe('useDayDnd', () => {
  it('초기 상태 — activeSchedule=null, previewDelta=0', () => {
    const { result } = renderHook(() => useDayDnd(baseOptions()))
    expect(result.current.activeSchedule).toBeNull()
    expect(result.current.previewDelta).toBe(0)
    expect(result.current.activeType).toBe('block')
  })

  it('handleDragStart → activeSchedule + activeType 설정', () => {
    const { result } = renderHook(() => useDayDnd(baseOptions()))
    const schedule = makeSchedule('s1')
    act(() => {
      result.current.handleDragStart({
        active: { data: { current: { schedule, type: 'resize-bottom' } } },
        activatorEvent: { target: null }
      } as unknown as DragStartEvent)
    })
    expect(result.current.activeSchedule).toBe(schedule)
    expect(result.current.activeType).toBe('resize-bottom')
  })

  it('handleDragMove → previewDelta = 15분 단위 반올림', () => {
    const { result } = renderHook(() => useDayDnd(baseOptions()))
    act(() => {
      // hourHeight=60, delta.y=60 → 60분 → 15분 단위 60
      result.current.handleDragMove({ delta: { y: 60 } } as unknown as DragMoveEvent)
    })
    expect(result.current.previewDelta).toBe(60)
  })

  it('handleDragEnd — minutesDelta=0 → mutation 안 호출', () => {
    const options = baseOptions()
    const { result } = renderHook(() => useDayDnd(options))
    act(() => {
      result.current.handleDragEnd({
        active: { data: { current: { schedule: makeSchedule('s1') } } },
        delta: { y: 0 }
      } as unknown as DragEndEvent)
    })
    expect(options.onMoveSchedule).not.toHaveBeenCalled()
    expect(options.onMoveTodo).not.toHaveBeenCalled()
  })

  it('handleDragEnd — non-todo schedule + 시간 이동 → onMoveSchedule 호출', () => {
    const options = baseOptions()
    const { result } = renderHook(() => useDayDnd(options))
    const schedule = makeSchedule('s1')
    act(() => {
      result.current.handleDragEnd({
        active: { data: { current: { schedule } } },
        delta: { y: 60 } // 60분
      } as unknown as DragEndEvent)
    })
    expect(options.onMoveSchedule).toHaveBeenCalledTimes(1)
    expect(options.onMoveTodo).not.toHaveBeenCalled()
  })

  it('handleDragEnd — todo schedule → onMoveTodo 호출 (id slice)', () => {
    const options = baseOptions()
    const { result } = renderHook(() => useDayDnd(options))
    act(() => {
      result.current.handleDragEnd({
        active: { data: { current: { schedule: makeSchedule('abc', true) } } },
        delta: { y: 60 }
      } as unknown as DragEndEvent)
    })
    expect(options.onMoveTodo).toHaveBeenCalledTimes(1)
    expect((options.onMoveTodo as ReturnType<typeof vi.fn>).mock.calls[0][0].todoId).toBe('abc')
    expect(options.onMoveSchedule).not.toHaveBeenCalled()
  })

  it('handleDragEnd → activeSchedule reset + previewDelta=0', () => {
    const { result } = renderHook(() => useDayDnd(baseOptions()))
    act(() => {
      result.current.handleDragStart({
        active: { data: { current: { schedule: makeSchedule('s1') } } },
        activatorEvent: { target: null }
      } as unknown as DragStartEvent)
    })
    expect(result.current.activeSchedule).not.toBeNull()
    act(() => {
      result.current.handleDragEnd({
        active: { data: { current: { schedule: makeSchedule('s1') } } },
        delta: { y: 0 }
      } as unknown as DragEndEvent)
    })
    expect(result.current.activeSchedule).toBeNull()
    expect(result.current.previewDelta).toBe(0)
  })
})
