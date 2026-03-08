import React, { useMemo } from 'react'
import { DndContext, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { differenceInCalendarDays } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import { useMoveSchedule } from '@entities/schedule'
import { useUpdateTodo } from '@entities/todo'
import { HOUR_HEIGHT, DND_ACTIVATION_CONSTRAINT } from '../model/calendar-constants'
import {
  isScheduleOnDate,
  layoutOverlappingSchedules,
  timeToPosition,
  scheduleHeight,
  isTodoItem
} from '../model/calendar-utils'
import { getScheduleColor } from '../model/schedule-color'
import { getItemStyle } from '../model/schedule-style'
import { useDayDnd } from '../model/use-day-dnd'
import { useDayViewTimeSettings } from '../model/use-day-view-time-settings'
import { useScheduleResize } from '../model/use-schedule-resize'
import { ScheduleBlock } from './ScheduleBlock'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'
import { TimeGrid } from './TimeGrid'
import { ScheduleDragOverlay } from './ScheduleDragOverlay'

interface Props {
  schedules: ScheduleItem[]
  currentDate: Date
  workspaceId: string
}

export function DayView({ schedules, currentDate, workspaceId }: Props): React.JSX.Element {
  const moveSchedule = useMoveSchedule()
  const updateTodo = useUpdateTodo()
  const { settings: timeSettings } = useDayViewTimeSettings()

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

  const layoutInput = useMemo(() => {
    return timed.map((s) => {
      const clamp = clampMap.get(s.id)
      if (!clamp) return s
      return { ...s, startAt: clamp.start, endAt: clamp.end }
    })
  }, [timed, clampMap])

  const layouted = useMemo(() => layoutOverlappingSchedules(layoutInput), [layoutInput])

  const mutationCallbacks = {
    onMoveSchedule: (p: { scheduleId: string; startAt: Date; endAt: Date; workspaceId: string }) =>
      moveSchedule.mutate(p),
    onMoveTodo: (p: {
      workspaceId: string
      todoId: string
      data: { startDate: Date; dueDate: Date }
    }) => updateTodo.mutate(p)
  }

  const dnd = useDayDnd({
    workspaceId,
    hourHeight: HOUR_HEIGHT,
    clampMap,
    ...mutationCallbacks
  })

  const resize = useScheduleResize({
    workspaceId,
    hourHeight: HOUR_HEIGHT,
    clampMap,
    ...mutationCallbacks
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: DND_ACTIVATION_CONSTRAINT })
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={dnd.handleDragStart}
      onDragMove={dnd.handleDragMove}
      onDragEnd={dnd.handleDragEnd}
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
                  style={getItemStyle(s)}
                >
                  {isTodoItem(s) && <span className="opacity-60 mr-0.5">{s.isDone ? '☑' : '☐'}</span>}
                  <span className={s.isDone ? 'line-through opacity-60' : ''}>{s.title}</span>
                </div>
              </ScheduleDetailPopover>
            ))}
          </div>
        )}

        {/* 타임그리드 */}
        <TimeGrid
          hourHeight={HOUR_HEIGHT}
          labelWidth="auto"
          labelClass="w-8 text-[9px] @[400px]:w-10 @[400px]:text-[10px] @[800px]:w-14 @[800px]:text-xs"
          startHour={timeSettings.startHour}
          endHour={timeSettings.endHour}
        >
          {layouted.map((l) => {
            const original = timed.find((s) => s.id === l.schedule.id)!
            const clamp = clampMap.get(l.schedule.id)
            return (
              <ScheduleBlock
                key={l.schedule.id}
                schedule={original}
                workspaceId={workspaceId}
                hourHeight={HOUR_HEIGHT}
                column={l.column}
                totalColumns={l.totalColumns}
                span={l.span}
                showTime
                showDescription
                displayStartAt={clamp?.start}
                displayEndAt={clamp?.end}
                startHour={timeSettings.startHour}
                resizable
                onResizeStart={resize.handleResizeStart}
              />
            )
          })}

          {/* DnD drop preview */}
          {dnd.activeSchedule &&
            dnd.previewDelta !== 0 &&
            (() => {
              const color = getScheduleColor(dnd.activeSchedule)
              const isTodo = isTodoItem(dnd.activeSchedule)
              const clamp = clampMap.get(dnd.activeSchedule.id)
              const baseStart = clamp?.start ?? dnd.activeSchedule.startAt
              const baseEnd = clamp?.end ?? dnd.activeSchedule.endAt
              const previewStart = new Date(baseStart.getTime() + dnd.previewDelta * 60 * 1000)
              return (
                <div
                  className="absolute left-0 right-0 rounded-sm pointer-events-none"
                  style={{
                    top: timeToPosition(previewStart, HOUR_HEIGHT, timeSettings.startHour),
                    height: scheduleHeight(baseStart, baseEnd, HOUR_HEIGHT),
                    backgroundColor: `${color}${isTodo ? '06' : '15'}`,
                    border: `1.5px dashed ${color}${isTodo ? '40' : '60'}`,
                  }}
                >
                  <div className="px-1 py-0.5">
                    <div
                      className="text-[11px] font-medium truncate leading-tight"
                      style={{ color }}
                    >
                      {isTodo && <span className="opacity-60 mr-0.5">☑</span>}
                      {dnd.activeSchedule.title}
                    </div>
                  </div>
                </div>
              )
            })()}

          {/* 리사이즈 프리뷰 */}
          {resize.resizing &&
            resize.resizeDelta !== 0 &&
            (() => {
              const color = getScheduleColor(resize.resizing.schedule)
              const isTodo = isTodoItem(resize.resizing.schedule)
              const clamp = clampMap.get(resize.resizing.schedule.id)
              const baseStart = clamp?.start ?? resize.resizing.schedule.startAt
              const baseEnd = clamp?.end ?? resize.resizing.schedule.endAt
              const previewStart =
                resize.resizing.edge === 'top'
                  ? new Date(baseStart.getTime() + resize.resizeDelta * 60 * 1000)
                  : baseStart
              const previewEnd =
                resize.resizing.edge === 'bottom'
                  ? new Date(baseEnd.getTime() + resize.resizeDelta * 60 * 1000)
                  : baseEnd
              return (
                <div
                  className="absolute left-0 right-0 rounded-sm pointer-events-none"
                  style={{
                    top: timeToPosition(previewStart, HOUR_HEIGHT, timeSettings.startHour),
                    height: scheduleHeight(previewStart, previewEnd, HOUR_HEIGHT),
                    backgroundColor: `${color}${isTodo ? '06' : '15'}`,
                    border: `1.5px dashed ${color}${isTodo ? '40' : '60'}`,
                  }}
                >
                  <div className="px-1 py-0.5">
                    <div
                      className="text-[11px] font-medium truncate leading-tight"
                      style={{ color }}
                    >
                      {isTodo && <span className="opacity-60 mr-0.5">☑</span>}
                      {resize.resizing.schedule.title}
                    </div>
                  </div>
                </div>
              )
            })()}
        </TimeGrid>
      </div>

      <ScheduleDragOverlay
        activeSchedule={dnd.activeSchedule}
        activeType={dnd.activeType}
        activeWidth={dnd.activeSize?.width}
        activeHeight={dnd.activeSize?.height}
      />
    </DndContext>
  )
}
