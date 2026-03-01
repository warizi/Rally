import { useMemo, useState } from 'react'
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
import type { ScheduleItem } from '@entities/schedule'
import { useMoveSchedule } from '@entities/schedule'
import {
  getMonthGrid,
  isScheduleOnDate,
  splitBarByWeeks,
  type MonthGridDay,
  type WeekBarSegment
} from '../model/calendar-utils'
import { getScheduleColor } from '../model/schedule-color'
import { MonthDayCell } from './MonthDayCell'
import { ScheduleDot } from './ScheduleDot'
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
const BAR_HEIGHT = 18
const BAR_GAP = 2

interface LanedSegment extends WeekBarSegment {
  schedule: ScheduleItem
  lane: number
}

function assignLanes(
  segments: { schedule: ScheduleItem; segment: WeekBarSegment }[]
): LanedSegment[] {
  const lanes: { endCol: number }[] = []
  const result: LanedSegment[] = []

  const sorted = [...segments].sort((a, b) => {
    if (a.segment.startCol !== b.segment.startCol) return a.segment.startCol - b.segment.startCol
    return b.segment.span - a.segment.span
  })

  for (const { schedule, segment } of sorted) {
    let lane = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].endCol <= segment.startCol) {
        lane = i
        lanes[i].endCol = segment.startCol + segment.span
        break
      }
    }
    if (lane === -1) {
      lane = lanes.length
      lanes.push({ endCol: segment.startCol + segment.span })
    }
    result.push({ ...segment, schedule, lane })
  }

  return result
}

export function MonthView({
  schedules,
  currentDate,
  selectedDate,
  onSelectDate,
  workspaceId
}: Props): React.JSX.Element {
  const moveSchedule = useMoveSchedule()
  const [activeSchedule, setActiveSchedule] = useState<ScheduleItem | null>(null)
  const [activeType, setActiveType] = useState<DragItemType>('bar')
  const [overDate, setOverDate] = useState<Date | null>(null)
  const [grabDayOffset, setGrabDayOffset] = useState(0)

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
    const result: { schedule: ScheduleItem; segment: WeekBarSegment }[][] = grid.map(() => [])

    for (const schedule of multiDay) {
      const segments = splitBarByWeeks(schedule, grid)
      for (const segment of segments) {
        result[segment.weekIndex].push({ schedule, segment })
      }
    }

    return result.map((weekSegments) => assignLanes(weekSegments))
  }, [multiDay, grid])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
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
    if (daysDelta === 0) return

    moveSchedule.mutate({
      scheduleId: schedule.id,
      startAt: new Date(schedule.startAt.getTime() + daysDelta * 86400000),
      endAt: new Date(schedule.endAt.getTime() + daysDelta * 86400000),
      workspaceId
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
      <div className="flex flex-col flex-1 overflow-auto items-center">
        <div className="w-full" style={{ aspectRatio: '8 / 10' }}>
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={i}
                className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'}`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* 월간 그리드 */}
          <div
            className="grid border-l border-t border-border"
            style={{
              gridTemplateRows: `repeat(${grid.length}, 1fr)`,
              height: 'calc(100% - 28px)'
            }}
          >
            {grid.map((week, weekIdx) => {
              const lanes = weekLanes[weekIdx]
              const laneCount = lanes.length > 0 ? Math.max(...lanes.map((l) => l.lane)) + 1 : 0
              const barAreaHeight = laneCount * (BAR_HEIGHT + BAR_GAP)

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
                        <MonthBarItem
                          key={`${ls.schedule.id}-w${weekIdx}`}
                          schedule={ls.schedule}
                          workspaceId={workspaceId}
                          startCol={ls.startCol}
                          span={ls.span}
                          lane={ls.lane}
                          isStart={ls.isStart}
                          isEnd={ls.isEnd}
                          weekIdx={weekIdx}
                          onGrab={(offset) => {
                            const segDate = week[ls.startCol].date
                            setGrabDayOffset(
                              differenceInCalendarDays(segDate, startOfDay(ls.schedule.startAt)) +
                                offset
                            )
                          }}
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
                            className="absolute rounded-sm text-[10px] leading-[18px] px-1 truncate pointer-events-none"
                            style={{
                              top: previewLane * (BAR_HEIGHT + BAR_GAP),
                              left: `${(seg.startCol / 7) * 100}%`,
                              width: `${(seg.span / 7) * 100}%`,
                              height: BAR_HEIGHT,
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
                      isSelected={!!selectedDate && isSameDay(day.date, selectedDate)}
                      onClick={onSelectDate}
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
        </div>

        {/* 소형 하단 목록 */}
        {selectedDate && (
          <SelectedDateList date={selectedDate} schedules={schedules} workspaceId={workspaceId} />
        )}
      </div>

      <ScheduleDragOverlay activeSchedule={activeSchedule} activeType={activeType} />
    </DndContext>
  )
}

// 월간 기간 바 아이템
function MonthBarItem({
  schedule,
  workspaceId,
  startCol,
  span,
  lane,
  isStart,
  isEnd,
  weekIdx,
  onGrab
}: {
  schedule: ScheduleItem
  workspaceId: string
  startCol: number
  span: number
  lane: number
  isStart: boolean
  isEnd: boolean
  weekIdx: number
  onGrab: (offset: number) => void
}): React.JSX.Element {
  const color = getScheduleColor(schedule)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bar-${schedule.id}-w${weekIdx}`,
    data: { schedule, type: 'bar' }
  })

  function handlePointerDown(e: React.PointerEvent): void {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const colWidth = rect.width / span
    const offset = Math.floor(clickX / colWidth)
    onGrab(offset)
    ;(listeners as Record<string, (e: React.PointerEvent) => void>)?.onPointerDown?.(e)
  }

  return (
    <div className="pointer-events-auto">
      <ScheduleDetailPopover schedule={schedule} workspaceId={workspaceId}>
        <div
          ref={setNodeRef}
          {...attributes}
          onPointerDown={handlePointerDown}
          className={`absolute cursor-pointer text-[10px] leading-[18px] px-1 truncate ${
            isStart ? 'rounded-l-sm' : ''
          } ${isEnd ? 'rounded-r-sm' : ''}`}
          style={{
            top: lane * (BAR_HEIGHT + BAR_GAP),
            left: `${(startCol / 7) * 100}%`,
            width: `${(span / 7) * 100}%`,
            height: BAR_HEIGHT,
            backgroundColor: `${color}20`,
            color,
            opacity: isDragging ? 0.4 : 1
          }}
        >
          {schedule.title}
        </div>
      </ScheduleDetailPopover>
    </div>
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
          <div
            key={s.id}
            className="h-[3px] rounded-full"
            style={{ backgroundColor: getScheduleColor(s) }}
          />
        ))}
        {daySchedules.length > 0 && (
          <div className="flex gap-0.5 flex-wrap">
            {daySchedules.slice(0, 3).map((s) => (
              <ScheduleDot key={s.id} schedule={s} />
            ))}
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
        {daySchedules.slice(0, 4).map((s, idx) => (
          <DraggableScheduleItem key={s.id} schedule={s} dayKey={dayKey}>
            <div className={idx >= 3 ? 'hidden @[800px]:block' : ''}>
              <ScheduleDetailPopover schedule={s} workspaceId={workspaceId}>
                <div
                  className="text-[10px] @[800px]:text-[11px] truncate rounded px-0.5 py-px cursor-pointer"
                  style={{
                    backgroundColor: `${getScheduleColor(s)}20`,
                    color: getScheduleColor(s)
                  }}
                >
                  <span className="hidden @[800px]:inline">{format(s.startAt, 'HH:mm')} </span>
                  {s.title}
                </div>
              </ScheduleDetailPopover>
            </div>
          </DraggableScheduleItem>
        ))}
        {daySchedules.length > 3 && (
          <div className="text-[10px] text-muted-foreground px-0.5 @[800px]:hidden">...</div>
        )}
        {daySchedules.length > 4 && (
          <div className="hidden @[800px]:block text-[10px] text-muted-foreground px-0.5">...</div>
        )}
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
            <div
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: getScheduleColor(s) }}
            />
            <span className="truncate">{s.title}</span>
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
