import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { format, isSameDay, differenceInCalendarDays, startOfDay } from 'date-fns'
import { useDraggable } from '@dnd-kit/core'
import { Circle, Check } from 'lucide-react'
import type { ScheduleItem } from '@entities/schedule'
import { useMoveSchedule } from '@entities/schedule'
import { useUpdateTodo } from '@entities/todo'
import {
  WEEKDAY_LABELS,
  MONTH_BAR_HEIGHT,
  BAR_GAP,
  DND_ACTIVATION_CONSTRAINT
} from '../model/calendar-constants'
import {
  getMonthGrid,
  isScheduleOnDate,
  splitBarByWeeks,
  isTodoItem,
  type MonthGridDay
} from '../model/calendar-utils'
import { assignLanes } from '../model/calendar-layout'
import { applyDaysDelta } from '../model/calendar-move'
import { getScheduleColor } from '../model/schedule-color'
import { getItemStyle, getItemDotStyle } from '../model/schedule-style'
import { ScrollArea } from '@shared/ui/scroll-area'
import { MonthDayCell } from './MonthDayCell'
import { ScheduleDot } from './ScheduleDot'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'
import { ScheduleDragOverlay, type DragItemType } from './ScheduleDragOverlay'
import { ScheduleBarItem } from './ScheduleBarItem'

interface Props {
  schedules: ScheduleItem[]
  currentDate: Date
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  workspaceId: string
}

export function MonthView({
  schedules,
  currentDate,
  selectedDate,
  onSelectDate,
  workspaceId
}: Props): React.JSX.Element {
  const moveSchedule = useMoveSchedule()
  const updateTodo = useUpdateTodo()
  const [activeSchedule, setActiveSchedule] = useState<ScheduleItem | null>(null)
  const [activeType, setActiveType] = useState<DragItemType>('bar')
  const [overDate, setOverDate] = useState<Date | null>(null)
  const [grabDayOffset, setGrabDayOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const isSmallRef = useRef(false)
  const [isSmall, setIsSmall] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = (width: number): void => {
      const small = width < 400
      isSmallRef.current = small
      setIsSmall(small)
      el.style.setProperty('--month-row-min', `${(width / 7) * 1.3}px`)
    }
    update(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleCellClick = useCallback(
    (date: Date) => {
      if (isSmall) onSelectDate(date)
    },
    [isSmall, onSelectDate]
  )

  const grid = useMemo(
    () => getMonthGrid(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  )

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

  const weekLanes = useMemo(() => {
    const result: {
      schedule: ScheduleItem
      startCol: number
      span: number
      isStart: boolean
      isEnd: boolean
    }[][] = grid.map(() => [])

    for (const schedule of multiDay) {
      const segments = splitBarByWeeks(schedule, grid)
      for (const segment of segments) {
        result[segment.weekIndex].push({ schedule, ...segment })
      }
    }

    return result.map((weekSegments) => assignLanes(weekSegments))
  }, [multiDay, grid])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: DND_ACTIVATION_CONSTRAINT })
  )

  function handleDragStart(event: DragStartEvent): void {
    const data = event.active.data.current
    const schedule = data?.schedule as ScheduleItem | undefined
    setActiveSchedule(schedule ?? null)
    setActiveType((data?.type as DragItemType) ?? 'bar')
    if (data?.type !== 'bar') {
      setGrabDayOffset(0)
    }
  }

  function handleDragOver(event: DragOverEvent): void {
    const date = event.over?.data.current?.date as Date | undefined
    setOverDate(date ?? null)
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveSchedule(null)
    setOverDate(null)
    const { active, over } = event
    if (!over) return

    const schedule = active.data.current?.schedule as ScheduleItem | undefined
    if (!schedule) return

    const targetDate = over.data.current?.date as Date | undefined
    if (!targetDate) return

    const daysDelta =
      differenceInCalendarDays(targetDate, startOfDay(schedule.startAt)) - grabDayOffset

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
      <div
        ref={containerRef}
        className="flex flex-col flex-1 overflow-hidden items-center month-container"
      >
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-border w-full">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={i}
              className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'}`}
            >
              {label}
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0 w-full">
          {/* 월간 그리드 */}
          <div
            className="grid border-l border-border month-grid"
            style={{
              gridTemplateRows: `repeat(${grid.length}, minmax(var(--month-row-min, 80px), auto))`
            }}
          >
            {grid.map((week, weekIdx) => {
              const lanes = weekLanes[weekIdx]
              const laneCount = lanes.length > 0 ? Math.max(...lanes.map((l) => l.lane)) + 1 : 0
              const barAreaHeight = laneCount * (MONTH_BAR_HEIGHT + BAR_GAP)

              // 기간 바 드래그 프리뷰 세그먼트
              const previewSegs =
                activeType === 'bar' && activeSchedule && overDate
                  ? (() => {
                      const daysDelta =
                        differenceInCalendarDays(overDate, startOfDay(activeSchedule.startAt)) -
                        grabDayOffset
                      if (daysDelta === 0) return []
                      const shifted = {
                        ...activeSchedule,
                        startAt: new Date(activeSchedule.startAt.getTime() + daysDelta * 86400000),
                        endAt: new Date(activeSchedule.endAt.getTime() + daysDelta * 86400000)
                      }
                      return splitBarByWeeks(shifted, grid).filter(
                        (seg) => seg.weekIndex === weekIdx
                      )
                    })()
                  : []

              return (
                <div key={weekIdx} className="grid grid-cols-7 relative">
                  {/* 기간 바 영역 (absolute) */}
                  {(barAreaHeight > 0 || previewSegs.length > 0) && (
                    <div
                      className="absolute inset-x-0 pointer-events-none z-10 hidden @[400px]:block"
                      style={{ top: 22 }}
                    >
                      {lanes.map((ls) => (
                        <ScheduleBarItem
                          key={`${ls.schedule.id}-w${weekIdx}`}
                          schedule={ls.schedule}
                          workspaceId={workspaceId}
                          startCol={ls.startCol}
                          span={ls.span}
                          lane={ls.lane}
                          isStart={ls.isStart}
                          isEnd={ls.isEnd}
                          barHeight={MONTH_BAR_HEIGHT}
                          draggableId={`bar-${ls.schedule.id}-w${weekIdx}`}
                          onGrab={(offset) => {
                            const segDate = week[ls.startCol].date
                            setGrabDayOffset(
                              differenceInCalendarDays(segDate, startOfDay(ls.schedule.startAt)) +
                                offset
                            )
                          }}
                          wrapperClassName="pointer-events-auto"
                        />
                      ))}

                      {/* 기간 바 드래그 프리뷰 */}
                      {previewSegs.map((seg, i) => {
                        const color = getScheduleColor(activeSchedule!)
                        const originalInWeek = lanes.find(
                          (ls) => ls.schedule.id === activeSchedule!.id
                        )
                        const previewLane = originalInWeek?.lane ?? 0
                        return (
                          <div
                            key={`preview-${i}`}
                            className="absolute rounded-sm text-[10px] px-1 truncate pointer-events-none"
                            style={{
                              lineHeight: `${MONTH_BAR_HEIGHT}px`,
                              top: previewLane * (MONTH_BAR_HEIGHT + BAR_GAP),
                              left: `${(seg.startCol / 7) * 100}%`,
                              width: `${(seg.span / 7) * 100}%`,
                              height: MONTH_BAR_HEIGHT,
                              backgroundColor: `${color}15`,
                              border: `1.5px dashed ${color}60`,
                              color
                            }}
                          >
                            {activeSchedule!.title}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* 셀 */}
                  {week.map((day) => (
                    <MonthDayCell
                      key={format(day.date, 'yyyy-MM-dd')}
                      day={day}
                      isSelected={isSmall && !!selectedDate && isSameDay(day.date, selectedDate)}
                      onClick={handleCellClick}
                      previewSchedule={activeType !== 'bar' ? activeSchedule : null}
                    >
                      <CellContent
                        day={day}
                        singleDay={singleDay}
                        multiDay={multiDay}
                        workspaceId={workspaceId}
                        barPadding={barAreaHeight}
                      />
                    </MonthDayCell>
                  ))}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {/* 소형 하단 목록 */}
        {selectedDate && (
          <SelectedDateList date={selectedDate} schedules={schedules} workspaceId={workspaceId} />
        )}
      </div>

      <ScheduleDragOverlay activeSchedule={activeSchedule} activeType={activeType} />
    </DndContext>
  )
}

// draggable 래퍼
function DraggableScheduleItem({
  schedule,
  dayKey,
  children
}: {
  schedule: ScheduleItem
  dayKey: string
  children: React.ReactNode
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `month-single-${schedule.id}-${dayKey}`,
    data: { schedule, type: 'single' }
  })

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0.4 : 1 }}>
      {children}
    </div>
  )
}

// 셀 내부 (단일 일정 표시, barPadding으로 바 아래 배치)
function CellContent({
  day,
  singleDay,
  multiDay,
  workspaceId,
  barPadding
}: {
  day: MonthGridDay
  singleDay: ScheduleItem[]
  multiDay: ScheduleItem[]
  workspaceId: string
  barPadding: number
}): React.JSX.Element {
  const daySchedules = singleDay.filter((s) => isScheduleOnDate(s, day.date))
  const dayMulti = multiDay.filter((s) => isScheduleOnDate(s, day.date))
  const dayKey = format(day.date, 'yyyy-MM-dd')

  return (
    <div className="min-h-4">
      {/* 소형: 줄(기간) + 도트(단일) + 넘침 표시 */}
      <div className="mt-1 space-y-0.5 @[400px]:hidden">
        {dayMulti.slice(0, 2).map((s) => (
          <div key={s.id} className="flex items-center gap-px">
            {isTodoItem(s) &&
              (s.isDone ? (
                <Check
                  className="size-2.5 shrink-0"
                  strokeWidth={3}
                  style={{ color: getScheduleColor(s) }}
                />
              ) : (
                <Circle
                  className="size-2 shrink-0"
                  strokeWidth={3}
                  style={{ color: getScheduleColor(s) }}
                />
              ))}
            <div
              className="h-[3px] flex-1 rounded-full"
              style={{ backgroundColor: getScheduleColor(s) }}
            />
          </div>
        ))}
        {daySchedules.length > 0 && (
          <div className="flex gap-0.5 flex-wrap">
            {daySchedules
              .slice(0, 3)
              .map((s) =>
                isTodoItem(s) ? (
                  s.isDone ? (
                    <Check
                      key={s.id}
                      className="size-2.5 shrink-0"
                      strokeWidth={3}
                      style={{ color: getScheduleColor(s) }}
                    />
                  ) : (
                    <Circle
                      key={s.id}
                      className="size-2 shrink-0"
                      strokeWidth={3}
                      style={{ color: getScheduleColor(s) }}
                    />
                  )
                ) : (
                  <ScheduleDot key={s.id} schedule={s} />
                )
              )}
          </div>
        )}
        {dayMulti.length + daySchedules.length > 5 && (
          <div className="text-[9px] text-muted-foreground leading-none">...</div>
        )}
      </div>

      {/* 중형+대형 */}
      <div
        className="hidden @[400px]:block space-y-px"
        style={{ marginTop: barPadding > 0 ? barPadding + 2 : 4 }}
      >
        {daySchedules.map((s) => (
          <DraggableScheduleItem key={s.id} schedule={s} dayKey={dayKey}>
            <ScheduleDetailPopover schedule={s} workspaceId={workspaceId}>
              <div
                className="flex items-center gap-0.5 text-[10px] @[800px]:text-[11px] truncate rounded px-0.5 py-px cursor-pointer"
                style={getItemStyle(s)}
              >
                {isTodoItem(s) ? (
                  s.isDone ? (
                    <Check
                      className="size-2.5 shrink-0"
                      strokeWidth={3}
                      style={{ color: getScheduleColor(s) }}
                    />
                  ) : (
                    <Circle
                      className="size-2 shrink-0"
                      strokeWidth={3}
                      style={{ color: getScheduleColor(s) }}
                    />
                  )
                ) : (
                  <div
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: getScheduleColor(s) }}
                  />
                )}
                <span className="hidden @[800px]:inline">{format(s.startAt, 'HH:mm')} </span>
                <span className={s.isDone ? 'line-through opacity-60' : ''}>{s.title}</span>
              </div>
            </ScheduleDetailPopover>
          </DraggableScheduleItem>
        ))}
      </div>
    </div>
  )
}

// 소형 하단 목록
function SelectedDateList({
  date,
  schedules,
  workspaceId
}: {
  date: Date
  schedules: ScheduleItem[]
  workspaceId: string
}): React.JSX.Element | null {
  const daySchedules = schedules.filter((s) => isScheduleOnDate(s, date))
  if (daySchedules.length === 0) return null

  return (
    <div className="@[400px]:hidden border-t border-border p-2 space-y-1 max-h-32 w-full h-fit">
      <div className="text-xs font-medium text-muted-foreground mb-1">
        {format(date, 'M월 d일')} 일정
      </div>
      {daySchedules.map((s) => (
        <ScheduleDetailPopover key={s.id} schedule={s} workspaceId={workspaceId}>
          <div className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-accent rounded px-1 py-0.5">
            {isTodoItem(s) ? (
              s.isDone ? (
                <Check
                  className="size-3 shrink-0"
                  strokeWidth={3}
                  style={{ color: getScheduleColor(s) }}
                />
              ) : (
                <Circle
                  className="size-2.5 shrink-0"
                  strokeWidth={3}
                  style={{ color: getScheduleColor(s) }}
                />
              )
            ) : (
              <div className="size-2 rounded-full shrink-0" style={getItemDotStyle(s)} />
            )}
            <span className={`truncate ${s.isDone ? 'line-through opacity-60' : ''}`}>
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
  )
}
