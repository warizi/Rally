import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScheduleResize } from '../use-schedule-resize'
import { makeScheduleItem } from './helpers'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createOptions(overrides?: Partial<Parameters<typeof useScheduleResize>[0]>) {
  return {
    workspaceId: 'ws-1',
    hourHeight: 60,
    clampMap: new Map(),
    onMoveSchedule: vi.fn(),
    onMoveTodo: vi.fn(),
    ...overrides
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeMockPointerEvent(clientY: number) {
  return {
    preventDefault: vi.fn(),
    clientY
  } as unknown as React.PointerEvent
}

describe('useScheduleResize', () => {
  describe('초기 상태', () => {
    it('resizing=null, resizeDelta=0', () => {
      const { result } = renderHook(() => useScheduleResize(createOptions()))
      expect(result.current.resizing).toBeNull()
      expect(result.current.resizeDelta).toBe(0)
    })
  })

  describe('handleResizeStart', () => {
    it('호출 → resizing 설정', () => {
      const schedule = makeScheduleItem()
      const { result } = renderHook(() => useScheduleResize(createOptions()))
      act(() => result.current.handleResizeStart(makeMockPointerEvent(100), schedule, 'bottom'))
      expect(result.current.resizing).toEqual({ schedule, edge: 'bottom' })
    })

    it('[SR-2] preventDefault 호출', () => {
      const mockEvent = makeMockPointerEvent(100)
      const { result } = renderHook(() => useScheduleResize(createOptions()))
      act(() => result.current.handleResizeStart(mockEvent, makeScheduleItem(), 'bottom'))
      expect(mockEvent.preventDefault).toHaveBeenCalled()
    })
  })

  describe('pointermove', () => {
    it('clientY 변화 → resizeDelta 업데이트', () => {
      const { result } = renderHook(() => useScheduleResize(createOptions()))
      act(() =>
        result.current.handleResizeStart(makeMockPointerEvent(100), makeScheduleItem(), 'bottom')
      )
      act(() => document.dispatchEvent(new PointerEvent('pointermove', { clientY: 160 })))
      // (160-100)/60*60 = 60, snapped to 15 → 60
      expect(result.current.resizeDelta).toBe(60)
    })

    it('[SR-3] 연속 pointermove → 매번 업데이트', () => {
      const { result } = renderHook(() => useScheduleResize(createOptions()))
      act(() =>
        result.current.handleResizeStart(makeMockPointerEvent(100), makeScheduleItem(), 'bottom')
      )
      act(() => document.dispatchEvent(new PointerEvent('pointermove', { clientY: 130 })))
      expect(result.current.resizeDelta).toBe(30)
      act(() => document.dispatchEvent(new PointerEvent('pointermove', { clientY: 160 })))
      expect(result.current.resizeDelta).toBe(60)
      act(() => document.dispatchEvent(new PointerEvent('pointermove', { clientY: 220 })))
      expect(result.current.resizeDelta).toBe(120)
    })
  })

  describe('pointerup — 일반 스케줄', () => {
    it('edge=bottom, delta>0 → endAt 변경, startAt 불변', () => {
      const schedule = makeScheduleItem({
        id: 'sched-1',
        startAt: new Date('2026-03-02T09:00:00'),
        endAt: new Date('2026-03-02T10:00:00')
      })
      const opts = createOptions()
      const { result } = renderHook(() => useScheduleResize(opts))
      act(() => result.current.handleResizeStart(makeMockPointerEvent(100), schedule, 'bottom'))
      act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: 160 })))
      expect(opts.onMoveSchedule).toHaveBeenCalledWith({
        scheduleId: 'sched-1',
        startAt: schedule.startAt,
        endAt: new Date(schedule.endAt.getTime() + 60 * 60 * 1000),
        workspaceId: 'ws-1'
      })
    })

    it('edge=top, delta>0 → startAt 변경, endAt 불변', () => {
      const schedule = makeScheduleItem({
        id: 'sched-1',
        startAt: new Date('2026-03-02T09:00:00'),
        endAt: new Date('2026-03-02T11:00:00')
      })
      const opts = createOptions()
      const { result } = renderHook(() => useScheduleResize(opts))
      act(() => result.current.handleResizeStart(makeMockPointerEvent(100), schedule, 'top'))
      act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: 160 })))
      expect(opts.onMoveSchedule).toHaveBeenCalledWith({
        scheduleId: 'sched-1',
        startAt: new Date(schedule.startAt.getTime() + 60 * 60 * 1000),
        endAt: schedule.endAt,
        workspaceId: 'ws-1'
      })
    })

    it('[X-2] edge=bottom일 때 startAt이 schedule.startAt과 동일', () => {
      const schedule = makeScheduleItem({ id: 'sched-1' })
      const opts = createOptions()
      const { result } = renderHook(() => useScheduleResize(opts))
      act(() => result.current.handleResizeStart(makeMockPointerEvent(100), schedule, 'bottom'))
      act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: 160 })))
      const callArg = opts.onMoveSchedule.mock.calls[0][0]
      expect(callArg.startAt).toBe(schedule.startAt) // 참조 동일
    })

    it('[SR-1] delta=0 → 콜백 미호출, 상태 리셋', () => {
      const opts = createOptions()
      const { result } = renderHook(() => useScheduleResize(opts))
      act(() =>
        result.current.handleResizeStart(makeMockPointerEvent(100), makeScheduleItem(), 'bottom')
      )
      act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: 100 })))
      expect(opts.onMoveSchedule).not.toHaveBeenCalled()
      expect(result.current.resizing).toBeNull()
      expect(result.current.resizeDelta).toBe(0)
    })
  })

  describe('pointerup — todo 아이템', () => {
    it('edge=bottom → dueDate만 변경', () => {
      const schedule = makeScheduleItem({
        id: 'todo:t1',
        startAt: new Date('2026-03-02T09:00:00'),
        endAt: new Date('2026-03-02T10:00:00')
      })
      const opts = createOptions()
      const { result } = renderHook(() => useScheduleResize(opts))
      act(() => result.current.handleResizeStart(makeMockPointerEvent(100), schedule, 'bottom'))
      act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: 160 })))
      expect(opts.onMoveTodo).toHaveBeenCalled()
      const callArg = opts.onMoveTodo.mock.calls[0][0]
      expect(callArg.todoId).toBe('t1')
      expect(callArg.data.dueDate.getHours()).toBe(11) // 10:00 + 60min
      expect(callArg.data.startDate.getHours()).toBe(9) // 불변
    })

    it('edge=top → startDate만 변경', () => {
      const schedule = makeScheduleItem({
        id: 'todo:t2',
        startAt: new Date('2026-03-02T09:00:00'),
        endAt: new Date('2026-03-02T11:00:00')
      })
      const opts = createOptions()
      const { result } = renderHook(() => useScheduleResize(opts))
      act(() => result.current.handleResizeStart(makeMockPointerEvent(100), schedule, 'top'))
      act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: 160 })))
      expect(opts.onMoveTodo).toHaveBeenCalled()
      const callArg = opts.onMoveTodo.mock.calls[0][0]
      expect(callArg.data.startDate.getHours()).toBe(10) // 09:00 + 60min
      expect(callArg.data.dueDate.getHours()).toBe(11) // 불변
    })

    it('clampMap 있음 → clamp 기준 사용', () => {
      const schedule = makeScheduleItem({
        id: 'todo:t3',
        startAt: new Date('2026-03-02T09:00:00'),
        endAt: new Date('2026-03-02T11:00:00')
      })
      const clampMap = new Map([
        [
          'todo:t3',
          {
            start: new Date('2026-03-02T08:00:00'),
            end: new Date('2026-03-02T10:00:00')
          }
        ]
      ])
      const opts = createOptions({ clampMap })
      const { result } = renderHook(() => useScheduleResize(opts))
      act(() => result.current.handleResizeStart(makeMockPointerEvent(100), schedule, 'bottom'))
      act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: 160 })))
      const callArg = opts.onMoveTodo.mock.calls[0][0]
      // baseEnd = clamp.end(10:00) + 60min = 11:00
      expect(callArg.data.dueDate.getHours()).toBe(11)
      // startDate uses clamp.start for base but edge=bottom so no offset → 08:00 hours applied to schedule.startAt
      expect(callArg.data.startDate.getHours()).toBe(8)
    })
  })

  describe('정리 검증', () => {
    it('pointerup 후 resizing=null, resizeDelta=0', () => {
      const schedule = makeScheduleItem()
      const { result } = renderHook(() => useScheduleResize(createOptions()))
      act(() => result.current.handleResizeStart(makeMockPointerEvent(100), schedule, 'bottom'))
      act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: 160 })))
      expect(result.current.resizing).toBeNull()
      expect(result.current.resizeDelta).toBe(0)
    })

    it('[SR-4] pointerup 후 추가 pointermove 무효', () => {
      const schedule = makeScheduleItem()
      const { result } = renderHook(() => useScheduleResize(createOptions()))
      act(() => result.current.handleResizeStart(makeMockPointerEvent(100), schedule, 'bottom'))
      act(() => document.dispatchEvent(new PointerEvent('pointerup', { clientY: 160 })))
      // Delta should be reset
      expect(result.current.resizeDelta).toBe(0)
      // Additional pointermove should not change delta
      act(() => document.dispatchEvent(new PointerEvent('pointermove', { clientY: 300 })))
      expect(result.current.resizeDelta).toBe(0)
    })
  })
})
