import { useState } from 'react'
import type { ScheduleItem } from '@entities/schedule'
import { isTodoItem } from './calendar-predicates'

interface Options {
  workspaceId: string
  hourHeight: number
  clampMap: Map<string, { start: Date; end: Date }>
  onMoveSchedule: (params: {
    scheduleId: string
    startAt: Date
    endAt: Date
    workspaceId: string
  }) => void
  onMoveTodo: (params: {
    workspaceId: string
    todoId: string
    data: { startDate: Date; dueDate: Date }
  }) => void
}

interface ResizeResult {
  resizing: { schedule: ScheduleItem; edge: 'top' | 'bottom' } | null
  resizeDelta: number
  handleResizeStart: (e: React.PointerEvent, schedule: ScheduleItem, edge: 'top' | 'bottom') => void
}

export function useScheduleResize({
  workspaceId,
  hourHeight,
  clampMap,
  onMoveSchedule,
  onMoveTodo
}: Options): ResizeResult {
  const [resizing, setResizing] = useState<{
    schedule: ScheduleItem
    edge: 'top' | 'bottom'
  } | null>(null)
  const [resizeDelta, setResizeDelta] = useState(0)

  function handleResizeStart(
    e: React.PointerEvent,
    schedule: ScheduleItem,
    edge: 'top' | 'bottom'
  ): void {
    e.preventDefault()
    const startY = e.clientY
    setResizing({ schedule, edge })
    setResizeDelta(0)

    function onMove(ev: PointerEvent): void {
      const delta = Math.round((((ev.clientY - startY) / hourHeight) * 60) / 15) * 15
      setResizeDelta(delta)
    }

    function onUp(ev: PointerEvent): void {
      const delta = Math.round((((ev.clientY - startY) / hourHeight) * 60) / 15) * 15

      if (delta !== 0) {
        const msOffset = delta * 60 * 1000

        if (isTodoItem(schedule)) {
          const clamp = clampMap.get(schedule.id)
          const baseStart = clamp?.start ?? schedule.startAt
          const baseEnd = clamp?.end ?? schedule.endAt
          const movedStart = edge === 'top' ? new Date(baseStart.getTime() + msOffset) : baseStart
          const movedEnd = edge === 'bottom' ? new Date(baseEnd.getTime() + msOffset) : baseEnd

          const newStart = new Date(schedule.startAt)
          newStart.setHours(movedStart.getHours(), movedStart.getMinutes(), 0, 0)
          const newEnd = new Date(schedule.endAt)
          newEnd.setHours(movedEnd.getHours(), movedEnd.getMinutes(), 0, 0)

          onMoveTodo({
            workspaceId,
            todoId: schedule.id.slice(5),
            data: { startDate: newStart, dueDate: newEnd }
          })
        } else {
          onMoveSchedule({
            scheduleId: schedule.id,
            startAt:
              edge === 'top' ? new Date(schedule.startAt.getTime() + msOffset) : schedule.startAt,
            endAt:
              edge === 'bottom' ? new Date(schedule.endAt.getTime() + msOffset) : schedule.endAt,
            workspaceId
          })
        }
      }

      setResizing(null)
      setResizeDelta(0)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return { resizing, resizeDelta, handleResizeStart }
}
