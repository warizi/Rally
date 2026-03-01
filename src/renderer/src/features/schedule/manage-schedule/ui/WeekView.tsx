import { useState, useMemo, useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { format, isSameDay, differenceInCalendarDays, startOfDay } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import { useMoveSchedule } from '@entities/schedule'
import { useUpdateTodo } from '@entities/todo'
import { ScrollArea } from '@shared/ui/scroll-area'
import {
  WEEKDAY_LABELS,
  WEEK_BAR_HEIGHT,
  BAR_GAP,
  DND_ACTIVATION_CONSTRAINT
} from '../model/calendar-constants'
import { getWeekDates, isScheduleOnDate, isTodoItem } from '../model/calendar-utils'
import { computeWeekBars } from '../model/calendar-layout'
import { applyDaysDelta } from '../model/calendar-move'
import { getScheduleColor } from '../model/schedule-color'
import { getItemDotStyle } from '../model/schedule-style'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'
import { ScheduleDragOverlay, type DragItemType } from './ScheduleDragOverlay'
import { ScheduleBarItem } from './ScheduleBarItem'
import { WeekDayCell } from './WeekDayCell'

interface Props {
  schedules: ScheduleItem[]
  currentDate: Date
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  workspaceId: string
}

export function WeekView({
  schedules,
  currentDate,
  selectedDate,
  onSelectDate,
  workspaceId
}: Props): React.JSX.Element {
  const moveSchedule = useMoveSchedule()
  const updateTodo = useUpdateTodo()
  const [activeSchedule, setActiveSchedule] = useState<ScheduleItem | null>(null)
  const [activeType, setActiveType] = useState<DragItemType>('single')
  const [activeWidth, setActiveWidth] = useState<number | undefined>(undefined)
  const [overDayIdx, setOverDayIdx] = useState<number | null>(null)
  const grabDayOffsetRef = useRef(0)

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate])

  const { multiDay, singleDay } = useMemo(() => {
    const multi: ScheduleItem[] = []
    const single: ScheduleItem[] = []
    for (const s of schedules) {
      if (s.allDay || differenceInCalendarDays(s.endAt, s.startAt) >= 1) {
        multi.push(s)
      } else {
        single.push(s)
      }
    }
    return { multiDay: multi, singleDay: single }
  }, [schedules])

  const weekBars = useMemo(() => computeWeekBars(multiDay, weekDates), [multiDay, weekDates])

  const barLaneCount = weekBars.length > 0 ? Math.max(...weekBars.map((b) => b.lane)) + 1 : 0
  const barAreaHeight = barLaneCount * (WEEK_BAR_HEIGHT + BAR_GAP)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: DND_ACTIVATION_CONSTRAINT })
  )

  function handleDragStart(event: DragStartEvent): void {
    const data = event.active.data.current
    const schedule = data?.schedule as ScheduleItem | undefined
    setActiveSchedule(schedule ?? null)
    setActiveType((data?.type as DragItemType) ?? 'single')

    if (data?.type !== 'bar') {
      grabDayOffsetRef.current = 0
    }
  }

  function handleDragOver(event: DragOverEvent): void {
    const overId = event.over?.id as string | undefined
    if (overId?.startsWith('week-cell-')) {
      setOverDayIdx(parseInt(overId.replace('week-cell-', ''), 10))
    } else {
      setOverDayIdx(null)
    }
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveSchedule(null)
    setOverDayIdx(null)
    const { active, over } = event
    if (!over) return

    const schedule = active.data.current?.schedule as ScheduleItem | undefined
    if (!schedule) return

    const targetDate = over.data.current?.date as Date | undefined
    if (!targetDate) return

    const daysDelta =
      differenceInCalendarDays(targetDate, startOfDay(schedule.startAt)) - grabDayOffsetRef.current

    applyDaysDelta(schedule, daysDelta, {
      onMoveSchedule: (id, start, end) =>
        moveSchedule.mutate({ scheduleId: id, startAt: start, endAt: end, workspaceId }),
      onMoveTodo: (id, start, end) =>
        updateTodo.mutate({ workspaceId, todoId: id, data: { startDate: start, dueDate: end } })
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 소형: 날짜 선택 바 + 목록 */}
        <div className="@[400px]:hidden flex flex-col flex-1 overflow-hidden">
          <div className="flex border-b border-border">
            {weekDates.map((d, i) => (
              <button
                key={i}
                className={`flex-1 py-1.5 text-center text-xs ${
                  selectedDate && isSameDay(d, selectedDate)
                    ? 'bg-primary text-primary-foreground'
                    : isSameDay(d, new Date())
                      ? 'bg-primary/10'
                      : ''
                }`}
                onClick={() => onSelectDate(d)}
              >
                <div className="font-medium">{WEEKDAY_LABELS[i]}</div>
                <div>{d.getDate()}</div>
              </button>
            ))}
          </div>
          <SmallDayList
            schedules={schedules}
            currentDate={selectedDate ?? currentDate}
            workspaceId={workspaceId}
          />
        </div>

        {/* 중형/대형: 7열 그리드 */}
        <div className="hidden @[400px]:flex flex-col flex-1 overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border border-border">
            {weekDates.map((d, i) => (
              <div
                key={i}
                className={`text-center py-1.5 border-r border-border cursor-pointer ${
                  isSameDay(d, new Date()) ? 'bg-primary/5' : ''
                }`}
                onClick={() => onSelectDate(d)}
              >
                <div
                  className={`text-[10px] @[800px]:text-xs font-medium ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'
                  }`}
                >
                  {WEEKDAY_LABELS[i]}
                </div>
                <div
                  className={`text-sm ${
                    isSameDay(d, new Date())
                      ? 'bg-primary text-primary-foreground rounded-full size-4 leading-4 text-center inline-block text-[10px]'
                      : ''
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* 기간 바 + 셀 */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="relative" style={{ minHeight: 500, height: '100%' }}>
              {/* 기간 바 (absolute) */}
              {barAreaHeight > 0 && (
                <div
                  className="absolute inset-x-0 top-0 z-10 pointer-events-none"
                  style={{ height: barAreaHeight }}
                >
                  {weekBars.map((bar, i) => (
                    <ScheduleBarItem
                      key={`${bar.schedule.id}-${i}`}
                      schedule={bar.schedule}
                      workspaceId={workspaceId}
                      startCol={bar.startCol}
                      span={bar.span}
                      lane={bar.lane}
                      isStart={bar.isStart}
                      isEnd={bar.isEnd}
                      barHeight={WEEK_BAR_HEIGHT}
                      draggableId={`week-bar-${bar.schedule.id}`}
                      draggableData={{ span: bar.span }}
                      onGrab={(offset, width) => {
                        const segDate = weekDates[bar.startCol]
                        grabDayOffsetRef.current =
                          differenceInCalendarDays(segDate, startOfDay(bar.schedule.startAt)) +
                          offset
                        setActiveWidth(width)
                      }}
                      wrapperClassName="pointer-events-auto"
                    />
                  ))}

                  {/* 기간 바 드래그 프리뷰 */}
                  {activeType === 'bar' &&
                    activeSchedule &&
                    overDayIdx !== null &&
                    // eslint-disable-next-line react-hooks/refs
                    (() => {
                      const fullSpan = Math.max(
                        1,
                        differenceInCalendarDays(activeSchedule.endAt, activeSchedule.startAt) + 1
                      )
                      const previewStartCol = overDayIdx - grabDayOffsetRef.current
                      const clampedStart = Math.max(0, previewStartCol)
                      const clampedEnd = Math.min(7, previewStartCol + fullSpan)
                      const clampedSpan = clampedEnd - clampedStart
                      if (clampedSpan <= 0) return null
                      const originalBar = weekBars.find((b) => b.schedule.id === activeSchedule.id)
                      const previewTop = (originalBar?.lane ?? 0) * (WEEK_BAR_HEIGHT + BAR_GAP)
                      const color = getScheduleColor(activeSchedule)
                      return (
                        <div
                          className="absolute rounded-sm text-[10px] px-1 truncate pointer-events-none"
                          style={{
                            lineHeight: `${WEEK_BAR_HEIGHT}px`,
                            top: previewTop,
                            left: `${(clampedStart / 7) * 100}%`,
                            width: `${(clampedSpan / 7) * 100}%`,
                            height: WEEK_BAR_HEIGHT,
                            backgroundColor: `${color}15`,
                            border: `1.5px dashed ${color}60`,
                            color
                          }}
                        >
                          {activeSchedule.title}
                        </div>
                      )
                    })()}
                </div>
              )}

              {/* 7열 셀 */}
              <div
                className="grid grid-cols-7 border-l border-b border-border"
                style={{ minHeight: 500 }}
              >
                {weekDates.map((d, i) => (
                  <WeekDayCell
                    key={i}
                    date={d}
                    dayIdx={i}
                    schedules={singleDay}
                    workspaceId={workspaceId}
                    barAreaHeight={barAreaHeight}
                    activeSchedule={activeType !== 'bar' ? activeSchedule : null}
                  />
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      <ScheduleDragOverlay
        activeSchedule={activeSchedule}
        activeType={activeType}
        activeWidth={activeWidth}
      />
    </DndContext>
  )
}

// 소형 날짜 목록
function SmallDayList({
  schedules,
  currentDate,
  workspaceId
}: {
  schedules: ScheduleItem[]
  currentDate: Date
  workspaceId: string
}): React.JSX.Element {
  const daySchedules = schedules.filter((s) => isScheduleOnDate(s, currentDate))

  if (daySchedules.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        일정 없음
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-2 space-y-1">
        {daySchedules.map((s) => (
          <ScheduleDetailPopover key={s.id} schedule={s} workspaceId={workspaceId}>
            <div className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-accent rounded px-1 py-0.5">
              <div className="size-2 rounded-full shrink-0" style={getItemDotStyle(s)} />
              <span className="truncate">
                {isTodoItem(s) && <span className="opacity-60 mr-0.5">☑</span>}
                {s.title}
              </span>
              {!s.allDay && (
                <span className="text-muted-foreground shrink-0 ml-auto">
                  {format(s.startAt, 'HH:mm')}
                </span>
              )}
            </div>
          </ScheduleDetailPopover>
        ))}
      </div>
    </ScrollArea>
  )
}
