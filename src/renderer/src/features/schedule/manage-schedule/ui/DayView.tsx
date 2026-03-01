import React, { useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { differenceInCalendarDays } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import { useMoveSchedule } from '@entities/schedule'
import { useUpdateTodo } from '@entities/todo'
import {
  isScheduleOnDate,
  layoutOverlappingSchedules,
  timeToPosition,
  scheduleHeight,
  isTodoItem
} from '../model/calendar-utils'
import { getScheduleColor } from '../model/schedule-color'
import { ScheduleBlock } from './ScheduleBlock'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'
import { TimeGrid } from './TimeGrid'
import { ScheduleDragOverlay, type DragItemType } from './ScheduleDragOverlay'

interface Props {
  schedules: ScheduleItem[]
  currentDate: Date
  workspaceId: string
}

export function DayView({ schedules, currentDate, workspaceId }: Props): React.JSX.Element {
  const moveSchedule = useMoveSchedule()
  const updateTodo = useUpdateTodo()
  const [activeSchedule, setActiveSchedule] = useState<ScheduleItem | null>(null)
  const [activeType, setActiveType] = useState<DragItemType>('block')
  const [previewDelta, setPreviewDelta] = useState(0)
  const [activeSize, setActiveSize] = useState<{ width: number; height: number } | undefined>()
  const [resizing, setResizing] = useState<{
    schedule: ScheduleItem
    edge: 'top' | 'bottom'
  } | null>(null)
  const [resizeDelta, setResizeDelta] = useState(0)

  const { allDay, timed } = useMemo(() => {
    const ad: ScheduleItem[] = []
    const t: ScheduleItem[] = []
    for (const s of schedules) {
      if (!isScheduleOnDate(s, currentDate)) continue
      if (s.allDay) {
        ad.push(s)
      } else {
        t.push(s)
      }
    }
    return { allDay: ad, timed: t }
  }, [schedules, currentDate])

  // 기간 스케줄: startAt/endAt의 시간(time-of-day)으로 당일 블록 생성
  const clampMap = useMemo(() => {
    const map = new Map<string, { start: Date; end: Date }>()

    for (const s of timed) {
      if (differenceInCalendarDays(s.endAt, s.startAt) >= 1) {
        const start = new Date(currentDate)
        start.setHours(s.startAt.getHours(), s.startAt.getMinutes(), 0, 0)
        const end = new Date(currentDate)
        end.setHours(s.endAt.getHours(), s.endAt.getMinutes(), 0, 0)
        if (end <= start) end.setHours(start.getHours() + 1)
        map.set(s.id, { start, end })
      }
    }
    return map
  }, [timed, currentDate])

  // 레이아웃 계산용 클램프된 스케줄
  const layoutInput = useMemo(() => {
    return timed.map((s) => {
      const clamp = clampMap.get(s.id)
      if (!clamp) return s
      return { ...s, startAt: clamp.start, endAt: clamp.end }
    })
  }, [timed, clampMap])

  const layouted = useMemo(() => layoutOverlappingSchedules(layoutInput), [layoutInput])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

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

    const hourHeight = 60
    const minutesDelta = Math.round(((event.delta.y / hourHeight) * 60) / 15) * 15
    if (minutesDelta === 0) return

    const msOffset = minutesDelta * 60 * 1000

    if (isTodoItem(schedule)) {
      // 시간만 변경하고 원래 날짜는 유지
      const clamp = clampMap.get(schedule.id)
      const baseStart = clamp?.start ?? schedule.startAt
      const baseEnd = clamp?.end ?? schedule.endAt
      const movedStart = new Date(baseStart.getTime() + msOffset)
      const movedEnd = new Date(baseEnd.getTime() + msOffset)

      const newStart = new Date(schedule.startAt)
      newStart.setHours(movedStart.getHours(), movedStart.getMinutes(), 0, 0)
      const newEnd = new Date(schedule.endAt)
      newEnd.setHours(movedEnd.getHours(), movedEnd.getMinutes(), 0, 0)

      updateTodo.mutate({
        workspaceId,
        todoId: schedule.id.slice(5),
        data: { startDate: newStart, dueDate: newEnd }
      })
    } else {
      moveSchedule.mutate({
        scheduleId: schedule.id,
        startAt: new Date(schedule.startAt.getTime() + msOffset),
        endAt: new Date(schedule.endAt.getTime() + msOffset),
        workspaceId
      })
    }
  }

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

          updateTodo.mutate({
            workspaceId,
            todoId: schedule.id.slice(5),
            data: { startDate: newStart, dueDate: newEnd }
          })
        } else {
          moveSchedule.mutate({
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

  const hourHeight = 60

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 종일 일정 */}
        {allDay.length > 0 && (
          <div className="border-b border-border p-2 space-y-0.5">
            <div className="text-[10px] text-muted-foreground mb-0.5">종일</div>
            {allDay.map((s) => (
              <ScheduleDetailPopover key={s.id} schedule={s} workspaceId={workspaceId}>
                <div
                  className="text-xs truncate rounded px-1.5 py-0.5 cursor-pointer"
                  style={{
                    backgroundColor: isTodoItem(s) ? 'transparent' : `${getScheduleColor(s)}20`,
                    border: isTodoItem(s) ? `1px solid ${getScheduleColor(s)}50` : undefined,
                    color: getScheduleColor(s)
                  }}
                >
                  {isTodoItem(s) && <span className="opacity-60 mr-0.5">☑</span>}
                  {s.title}
                </div>
              </ScheduleDetailPopover>
            ))}
          </div>
        )}

        {/* 타임그리드 */}
        <TimeGrid
          hourHeight={hourHeight}
          labelWidth="auto"
          labelClass="w-8 text-[9px] @[400px]:w-10 @[400px]:text-[10px] @[800px]:w-14 @[800px]:text-xs"
        >
          {layouted.map((l) => {
            const original = timed.find((s) => s.id === l.schedule.id)!
            const clamp = clampMap.get(l.schedule.id)
            return (
              <ScheduleBlock
                key={l.schedule.id}
                schedule={original}
                workspaceId={workspaceId}
                hourHeight={hourHeight}
                column={l.column}
                totalColumns={l.totalColumns}
                span={l.span}
                showTime
                showDescription
                displayStartAt={clamp?.start}
                displayEndAt={clamp?.end}
                resizable
                onResizeStart={handleResizeStart}
              />
            )
          })}

          {/* DnD drop preview */}
          {activeSchedule &&
            previewDelta !== 0 &&
            (() => {
              const color = getScheduleColor(activeSchedule)
              const clamp = clampMap.get(activeSchedule.id)
              const baseStart = clamp?.start ?? activeSchedule.startAt
              const baseEnd = clamp?.end ?? activeSchedule.endAt
              const previewStart = new Date(baseStart.getTime() + previewDelta * 60 * 1000)
              return (
                <div
                  className="absolute left-0 right-0 rounded-sm px-1 py-0.5 pointer-events-none"
                  style={{
                    top: timeToPosition(previewStart, hourHeight),
                    height: scheduleHeight(baseStart, baseEnd, hourHeight),
                    backgroundColor: `${color}15`,
                    border: `1.5px dashed ${color}60`,
                    borderLeftWidth: 2,
                    borderLeftColor: color,
                    borderLeftStyle: 'solid'
                  }}
                >
                  <div className="text-[11px] font-medium truncate leading-tight" style={{ color }}>
                    {activeSchedule.title}
                  </div>
                </div>
              )
            })()}

          {/* 리사이즈 프리뷰 */}
          {resizing &&
            resizeDelta !== 0 &&
            (() => {
              const color = getScheduleColor(resizing.schedule)
              const clamp = clampMap.get(resizing.schedule.id)
              const baseStart = clamp?.start ?? resizing.schedule.startAt
              const baseEnd = clamp?.end ?? resizing.schedule.endAt
              const previewStart =
                resizing.edge === 'top'
                  ? new Date(baseStart.getTime() + resizeDelta * 60 * 1000)
                  : baseStart
              const previewEnd =
                resizing.edge === 'bottom'
                  ? new Date(baseEnd.getTime() + resizeDelta * 60 * 1000)
                  : baseEnd
              return (
                <div
                  className="absolute left-0 right-0 rounded-sm pointer-events-none flex"
                  style={{
                    top: timeToPosition(previewStart, hourHeight),
                    height: scheduleHeight(previewStart, previewEnd, hourHeight),
                    backgroundColor: `${color}15`,
                    border: `1.5px dashed ${color}60`
                  }}
                >
                  <div
                    className="shrink-0 w-[4px] rounded-l-sm"
                    style={{ backgroundColor: `${color}60` }}
                  />
                  <div className="flex-1 min-w-0 px-1 py-0.5">
                    <div
                      className="text-[11px] font-medium truncate leading-tight"
                      style={{ color }}
                    >
                      {resizing.schedule.title}
                    </div>
                  </div>
                </div>
              )
            })()}
        </TimeGrid>
      </div>

      <ScheduleDragOverlay
        activeSchedule={activeSchedule}
        activeType={activeType}
        activeWidth={activeSize?.width}
        activeHeight={activeSize?.height}
      />
    </DndContext>
  )
}
