import { useState, useMemo, useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { format, isSameDay, differenceInCalendarDays, startOfDay, endOfDay, getDay } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import { useMoveSchedule } from '@entities/schedule'
import { useUpdateTodo } from '@entities/todo'
import { ScrollArea } from '@shared/ui/scroll-area'
import { getWeekDates, isScheduleOnDate, isTodoItem } from '../model/calendar-utils'
import { getScheduleColor } from '../model/schedule-color'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'
import { ScheduleDragOverlay, type DragItemType } from './ScheduleDragOverlay'

interface Props {
  schedules: ScheduleItem[]
  currentDate: Date
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  workspaceId: string
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const BAR_HEIGHT = 20
const BAR_GAP = 2

interface WeekBar {
  schedule: ScheduleItem
  startCol: number
  span: number
  isStart: boolean
  isEnd: boolean
  lane: number
}

function computeWeekBars(multiDay: ScheduleItem[], weekDates: Date[]): WeekBar[] {
  const weekStart = startOfDay(weekDates[0])
  const weekEnd = endOfDay(weekDates[6])

  const items: Omit<WeekBar, 'lane'>[] = []

  for (const s of multiDay) {
    if (s.startAt > weekEnd || s.endAt < weekStart) continue

    const effectiveStart = s.startAt < weekStart ? weekStart : s.startAt
    const effectiveEnd = s.endAt > weekEnd ? weekEnd : s.endAt

    const startCol = getDay(effectiveStart)
    const span = differenceInCalendarDays(startOfDay(effectiveEnd), startOfDay(effectiveStart)) + 1

    items.push({
      schedule: s,
      startCol,
      span,
      isStart: isSameDay(effectiveStart, s.startAt),
      isEnd: isSameDay(effectiveEnd, s.endAt)
    })
  }

  const sorted = [...items].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol
    return b.span - a.span
  })

  const lanes: { endCol: number }[] = []
  const result: WeekBar[] = []

  for (const item of sorted) {
    let lane = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].endCol <= item.startCol) {
        lane = i
        lanes[i].endCol = item.startCol + item.span
        break
      }
    }
    if (lane === -1) {
      lane = lanes.length
      lanes.push({ endCol: item.startCol + item.span })
    }
    result.push({ ...item, lane })
  }

  return result
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
  const barAreaHeight = barLaneCount * (BAR_HEIGHT + BAR_GAP)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
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
    if (daysDelta === 0) return

    if (isTodoItem(schedule)) {
      updateTodo.mutate({
        workspaceId,
        todoId: schedule.id.slice(5),
        data: {
          startDate: new Date(schedule.startAt.getTime() + daysDelta * 86400000),
          dueDate: new Date(schedule.endAt.getTime() + daysDelta * 86400000)
        }
      })
    } else {
      moveSchedule.mutate({
        scheduleId: schedule.id,
        startAt: new Date(schedule.startAt.getTime() + daysDelta * 86400000),
        endAt: new Date(schedule.endAt.getTime() + daysDelta * 86400000),
        workspaceId
      })
    }
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
                className={`flex-1 py-1.5 text-center text-xs ${selectedDate && isSameDay(d, selectedDate)
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
                className={`text-center py-1.5 border-r border-border cursor-pointer ${isSameDay(d, new Date()) ? 'bg-primary/5' : ''
                  }`}
                onClick={() => onSelectDate(d)}
              >
                <div
                  className={`text-[10px] @[800px]:text-xs font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'
                    }`}
                >
                  {WEEKDAY_LABELS[i]}
                </div>
                <div
                  className={`text-sm ${isSameDay(d, new Date())
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
                    <div key={`${bar.schedule.id}-${i}`} className="pointer-events-auto">
                      <WeekBarItem
                        schedule={bar.schedule}
                        workspaceId={workspaceId}
                        startCol={bar.startCol}
                        span={bar.span}
                        lane={bar.lane}
                        isStart={bar.isStart}
                        isEnd={bar.isEnd}
                        onGrab={(offset, width) => {
                          const segDate = weekDates[bar.startCol]
                          grabDayOffsetRef.current =
                            differenceInCalendarDays(segDate, startOfDay(bar.schedule.startAt)) +
                            offset
                          setActiveWidth(width)
                        }}
                      />
                    </div>
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
                      const previewTop = (originalBar?.lane ?? 0) * (BAR_HEIGHT + BAR_GAP)
                      const color = getScheduleColor(activeSchedule)
                      return (
                        <div
                          className="absolute rounded-sm text-[10px] leading-[20px] px-1 truncate pointer-events-none"
                          style={{
                            top: previewTop,
                            left: `${(clampedStart / 7) * 100}%`,
                            width: `${(clampedSpan / 7) * 100}%`,
                            height: BAR_HEIGHT,
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

// 기간 바 아이템
function WeekBarItem({
  schedule,
  workspaceId,
  startCol,
  span,
  lane,
  isStart,
  isEnd,
  onGrab
}: {
  schedule: ScheduleItem
  workspaceId: string
  startCol: number
  span: number
  lane: number
  isStart: boolean
  isEnd: boolean
  onGrab: (offset: number, width: number) => void
}): React.JSX.Element {
  const color = getScheduleColor(schedule)

  const isTodo = isTodoItem(schedule)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `week-bar-${schedule.id}`,
    data: { schedule, type: 'bar', span }
  })

  function handlePointerDown(e: React.PointerEvent): void {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const colWidth = rect.width / span
    const offset = Math.floor(clickX / colWidth)
    onGrab(offset, rect.width)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      ; (listeners as Record<string, Function>)?.onPointerDown?.(e)
  }

  return (
    <ScheduleDetailPopover schedule={schedule} workspaceId={workspaceId}>
      <div
        ref={setNodeRef}
        {...attributes}
        onPointerDown={handlePointerDown}
        className={`absolute cursor-pointer text-[10px] leading-[20px] px-1 truncate ${isStart ? 'rounded-l-sm' : ''
          } ${isEnd ? 'rounded-r-sm' : ''}`}
        style={{
          top: lane * (BAR_HEIGHT + BAR_GAP),
          left: `${(startCol / 7) * 100}%`,
          width: `${(span / 7) * 100}%`,
          height: BAR_HEIGHT,
          backgroundColor: isTodo ? 'transparent' : `${color}20`,
          border: isTodo ? `1px solid ${color}50` : undefined,
          color,
          opacity: isDragging ? 0.4 : 1
        }}
      >
        {isTodo && <span className="opacity-60 mr-0.5">☑</span>}
        {schedule.title}
      </div>
    </ScheduleDetailPopover>
  )
}

// droppable 셀
function WeekDayCell({
  date,
  dayIdx,
  schedules,
  workspaceId,
  barAreaHeight,
  activeSchedule
}: {
  date: Date
  dayIdx: number
  schedules: ScheduleItem[]
  workspaceId: string
  barAreaHeight: number
  activeSchedule: ScheduleItem | null
}): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: `week-cell-${dayIdx}`,
    data: { date }
  })

  const daySchedules = schedules.filter((s) => isScheduleOnDate(s, date))

  return (
    <div
      ref={setNodeRef}
      className={`border-r border-border p-1 space-y-0.5 ${isOver ? 'bg-accent/30' : ''}`}
      style={{ paddingTop: barAreaHeight > 0 ? barAreaHeight + 4 : undefined }}
    >
      {daySchedules.map((s) => (
        <DraggableScheduleItem key={s.id} schedule={s}>
          <ScheduleDetailPopover schedule={s} workspaceId={workspaceId}>
            <div
              className="text-[10px] @[800px]:text-[11px] truncate rounded px-1 py-px cursor-pointer"
              style={{
                backgroundColor: isTodoItem(s) ? 'transparent' : `${getScheduleColor(s)}20`,
                border: isTodoItem(s) ? `1px solid ${getScheduleColor(s)}50` : undefined,
                color: getScheduleColor(s)
              }}
            >
              {isTodoItem(s) && <span className="opacity-60 mr-0.5">☑</span>}
              {!s.allDay && (
                <span className="hidden @[800px]:inline">{format(s.startAt, 'HH:mm')} </span>
              )}
              {s.title}
            </div>
          </ScheduleDetailPopover>
        </DraggableScheduleItem>
      ))}

      {/* DnD drop preview */}
      {isOver && activeSchedule && (
        <div
          className="text-[10px] truncate rounded px-1 py-px pointer-events-none"
          style={{
            backgroundColor: `${getScheduleColor(activeSchedule)}15`,
            border: `1.5px dashed ${getScheduleColor(activeSchedule)}60`,
            color: getScheduleColor(activeSchedule)
          }}
        >
          {activeSchedule.title}
        </div>
      )}
    </div>
  )
}

// draggable 래퍼
function DraggableScheduleItem({
  schedule,
  children
}: {
  schedule: ScheduleItem
  children: React.ReactNode
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `week-single-${schedule.id}`,
    data: { schedule, type: 'single' }
  })

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {children}
    </div>
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
              <div
                className="size-2 rounded-full shrink-0"
                style={{
                  backgroundColor: isTodoItem(s) ? 'transparent' : getScheduleColor(s),
                  border: isTodoItem(s) ? `1.5px solid ${getScheduleColor(s)}` : undefined
                }}
              />
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
