import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/core'
import { useDayDnd } from '../use-day-dnd'
import { makeScheduleItem } from './helpers'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createOptions(overrides?: Partial<Parameters<typeof useDayDnd>[0]>) {
  return {
    workspaceId: 'ws-1',
    hourHeight: 60,
    clampMap: new Map(),
    onMoveSchedule: vi.fn(),
    onMoveTodo: vi.fn(),
    ...overrides
  }
}

function makeDragStartEvent(data?: Record<string, unknown>): DragStartEvent {
  return {
    active: {
      data: { current: data }
    },
    activatorEvent: { target: null }
  } as unknown as DragStartEvent
}

function makeDragMoveEvent(deltaY: number): DragMoveEvent {
  return {
    delta: { y: deltaY }
  } as unknown as DragMoveEvent
}

function makeDragEndEvent(deltaY: number, data?: Record<string, unknown>): DragEndEvent {
  return {
    active: {
      data: { current: data }
    },
    delta: { y: deltaY }
  } as unknown as DragEndEvent
}

describe('useDayDnd', () => {
  describe('초기 상태', () => {
    it('activeSchedule=null, activeType=block, previewDelta=0', () => {
      const { result } = renderHook(() => useDayDnd(createOptions()))
      expect(result.current.activeSchedule).toBeNull()
      expect(result.current.activeType).toBe('block')
      expect(result.current.previewDelta).toBe(0)
      expect(result.current.activeSize).toBeUndefined()
    })
  })

  describe('handleDragStart', () => {
    it('schedule 있는 이벤트 → activeSchedule 설정', () => {
      const schedule = makeScheduleItem()
      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() => result.current.handleDragStart(makeDragStartEvent({ schedule, type: 'block' })))
      expect(result.current.activeSchedule).toEqual(schedule)
    })

    it('schedule 없는 이벤트 → activeSchedule=null', () => {
      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() => result.current.handleDragStart(makeDragStartEvent({})))
      expect(result.current.activeSchedule).toBeNull()
    })

    it('type=bar → activeType=bar', () => {
      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() =>
        result.current.handleDragStart(
          makeDragStartEvent({ schedule: makeScheduleItem(), type: 'bar' })
        )
      )
      expect(result.current.activeType).toBe('bar')
    })

    it('type 없음 → activeType=block (기본값)', () => {
      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() =>
        result.current.handleDragStart(makeDragStartEvent({ schedule: makeScheduleItem() }))
      )
      expect(result.current.activeType).toBe('block')
    })

    it('activatorEvent.target에 DOM 요소 → activeSize 설정', () => {
      const el = document.createElement('div')
      el.setAttribute('data-block-id', 'sched-1')
      Object.defineProperty(el, 'offsetWidth', { value: 200 })
      Object.defineProperty(el, 'offsetHeight', { value: 60 })
      document.body.appendChild(el)

      const event = {
        active: {
          data: { current: { schedule: makeScheduleItem(), type: 'block' } }
        },
        activatorEvent: { target: el }
      } as unknown as DragStartEvent

      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() => result.current.handleDragStart(event))
      expect(result.current.activeSize).toEqual({ width: 200, height: 60 })

      document.body.removeChild(el)
    })

    it('[DD-3] data.current undefined → activeSchedule=null', () => {
      const event = {
        active: { data: { current: undefined } },
        activatorEvent: { target: null }
      } as unknown as DragStartEvent
      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() => result.current.handleDragStart(event))
      expect(result.current.activeSchedule).toBeNull()
    })
  })

  describe('handleDragMove', () => {
    it('delta.y=60, hourHeight=60 → previewDelta=60', () => {
      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() => result.current.handleDragMove(makeDragMoveEvent(60)))
      expect(result.current.previewDelta).toBe(60)
    })

    it('delta.y=30, hourHeight=60 → previewDelta=30', () => {
      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() => result.current.handleDragMove(makeDragMoveEvent(30)))
      expect(result.current.previewDelta).toBe(30)
    })

    it('delta.y=0 → previewDelta=0', () => {
      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() => result.current.handleDragMove(makeDragMoveEvent(0)))
      expect(result.current.previewDelta).toBe(0)
    })
  })

  describe('handleDragEnd', () => {
    it('[DD-1] schedule 없어도 상태 리셋', () => {
      const { result } = renderHook(() => useDayDnd(createOptions()))
      act(() =>
        result.current.handleDragStart(makeDragStartEvent({ schedule: makeScheduleItem() }))
      )
      act(() => result.current.handleDragEnd(makeDragEndEvent(60, {})))
      expect(result.current.activeSchedule).toBeNull()
      expect(result.current.previewDelta).toBe(0)
    })

    it('delta.y=0 → 콜백 미호출, 상태 리셋', () => {
      const opts = createOptions()
      const schedule = makeScheduleItem()
      const { result } = renderHook(() => useDayDnd(opts))
      act(() => result.current.handleDragEnd(makeDragEndEvent(0, { schedule })))
      expect(opts.onMoveSchedule).not.toHaveBeenCalled()
      expect(opts.onMoveTodo).not.toHaveBeenCalled()
      expect(result.current.activeSchedule).toBeNull()
    })

    it('일반 스케줄 + delta → onMoveSchedule 호출', () => {
      const opts = createOptions()
      const schedule = makeScheduleItem({ id: 'sched-1' })
      const { result } = renderHook(() => useDayDnd(opts))
      act(() => result.current.handleDragEnd(makeDragEndEvent(60, { schedule })))
      expect(opts.onMoveSchedule).toHaveBeenCalledWith({
        scheduleId: 'sched-1',
        startAt: expect.any(Date),
        endAt: expect.any(Date),
        workspaceId: 'ws-1'
      })
    })

    it('todo 아이템 + delta → onMoveTodo 호출 (ID 슬라이싱)', () => {
      const opts = createOptions()
      const schedule = makeScheduleItem({ id: 'todo:abc123' })
      const { result } = renderHook(() => useDayDnd(opts))
      act(() => result.current.handleDragEnd(makeDragEndEvent(60, { schedule })))
      expect(opts.onMoveTodo).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        todoId: 'abc123',
        data: { startDate: expect.any(Date), dueDate: expect.any(Date) }
      })
    })

    it('todo + clampMap 있음 → clamp 기준 사용', () => {
      const schedule = makeScheduleItem({
        id: 'todo:t1',
        startAt: new Date('2026-03-02T09:00:00'),
        endAt: new Date('2026-03-04T10:00:00')
      })
      const clampMap = new Map([
        [
          'todo:t1',
          {
            start: new Date('2026-03-02T08:00:00'),
            end: new Date('2026-03-02T09:00:00')
          }
        ]
      ])
      const opts = createOptions({ clampMap })
      const { result } = renderHook(() => useDayDnd(opts))
      act(() => result.current.handleDragEnd(makeDragEndEvent(60, { schedule })))
      expect(opts.onMoveTodo).toHaveBeenCalled()
      const callArg = vi.mocked(opts.onMoveTodo).mock.calls[0][0]
      // clamp base used → movedStart based on 08:00, movedEnd based on 09:00
      // 60px / 60 hourHeight = 1hour = 60min
      expect(callArg.data.startDate.getHours()).toBe(9) // 08:00 + 60min
      expect(callArg.data.dueDate.getHours()).toBe(10) // 09:00 + 60min
    })

    it('todo + clampMap 없음 → schedule.startAt/endAt 사용', () => {
      const schedule = makeScheduleItem({
        id: 'todo:t2',
        startAt: new Date('2026-03-02T09:00:00'),
        endAt: new Date('2026-03-02T10:00:00')
      })
      const opts = createOptions()
      const { result } = renderHook(() => useDayDnd(opts))
      act(() => result.current.handleDragEnd(makeDragEndEvent(60, { schedule })))
      const callArg = vi.mocked(opts.onMoveTodo).mock.calls[0][0]
      expect(callArg.data.startDate.getHours()).toBe(10) // 09:00 + 60min
      expect(callArg.data.dueDate.getHours()).toBe(11) // 10:00 + 60min
    })

    it('[DD-2] todo 날짜 보존/시간 변경: 다일 스케줄', () => {
      const schedule = makeScheduleItem({
        id: 'todo:t3',
        startAt: new Date('2026-03-02T09:00:00'),
        endAt: new Date('2026-03-05T10:00:00')
      })
      const opts = createOptions()
      const { result } = renderHook(() => useDayDnd(opts))
      act(() => result.current.handleDragEnd(makeDragEndEvent(60, { schedule })))
      const callArg = vi.mocked(opts.onMoveTodo).mock.calls[0][0]
      // 날짜는 유지, 시간만 변경
      expect(callArg.data.startDate.getDate()).toBe(2) // 3/2 유지
      expect(callArg.data.dueDate.getDate()).toBe(5) // 3/5 유지
      expect(callArg.data.startDate.getHours()).toBe(10) // 시간 +1h
      expect(callArg.data.dueDate.getHours()).toBe(11) // 시간 +1h
    })

    it('호출 후 상태 리셋', () => {
      const opts = createOptions()
      const schedule = makeScheduleItem()
      const { result } = renderHook(() => useDayDnd(opts))
      act(() => result.current.handleDragEnd(makeDragEndEvent(60, { schedule })))
      expect(result.current.activeSchedule).toBeNull()
      expect(result.current.previewDelta).toBe(0)
    })
  })
})
