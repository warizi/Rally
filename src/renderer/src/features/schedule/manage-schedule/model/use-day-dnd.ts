import { useState } from 'react'
import type { DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core'
import type { ScheduleItem } from '@entities/schedule'
import type { DragItemType } from '../ui/ScheduleDragOverlay'
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

interface DayDndResult {
  activeSchedule: ScheduleItem | null
  activeType: DragItemType
  previewDelta: number
  activeSize: { width: number; height: number } | undefined
  handleDragStart: (event: DragStartEvent) => void
  handleDragMove: (event: DragMoveEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
}

export function useDayDnd({
  workspaceId,
  hourHeight,
  clampMap,
  onMoveSchedule,
  onMoveTodo
}: Options): DayDndResult {
  const [activeSchedule, setActiveSchedule] = useState<ScheduleItem | null>(null)
  const [activeType, setActiveType] = useState<DragItemType>('block')
  const [previewDelta, setPreviewDelta] = useState(0)
  const [activeSize, setActiveSize] = useState<{ width: number; height: number } | undefined>()

  function handleDragStart(event: DragStartEvent): void {
    const schedule = event.active.data.current?.schedule as ScheduleItem | undefined
    setActiveSchedule(schedule ?? null)
    setActiveType((event.active.data.current?.type as DragItemType) ?? 'block')

    const el = (event.activatorEvent.target as HTMLElement)?.closest?.(
      '[data-block-id]'
    ) as HTMLElement | null
    if (el) {
      setActiveSize({ width: el.offsetWidth, height: el.offsetHeight })
    }
  }

  function handleDragMove(event: DragMoveEvent): void {
    const minutesDelta = Math.round(((event.delta.y / hourHeight) * 60) / 15) * 15
    setPreviewDelta(minutesDelta)
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveSchedule(null)
    setPreviewDelta(0)
    const schedule = event.active.data.current?.schedule as ScheduleItem | undefined
    if (!schedule) return

    const minutesDelta = Math.round(((event.delta.y / hourHeight) * 60) / 15) * 15
    if (minutesDelta === 0) return

    const msOffset = minutesDelta * 60 * 1000

    if (isTodoItem(schedule)) {
      const clamp = clampMap.get(schedule.id)
      const baseStart = clamp?.start ?? schedule.startAt
      const baseEnd = clamp?.end ?? schedule.endAt
      const movedStart = new Date(baseStart.getTime() + msOffset)
      const movedEnd = new Date(baseEnd.getTime() + msOffset)

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
        startAt: new Date(schedule.startAt.getTime() + msOffset),
        endAt: new Date(schedule.endAt.getTime() + msOffset),
        workspaceId
      })
    }
  }

  return {
    activeSchedule,
    activeType,
    previewDelta,
    activeSize,
    handleDragStart,
    handleDragMove,
    handleDragEnd
  }
}
