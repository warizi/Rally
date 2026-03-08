import { useDraggable } from '@dnd-kit/core'
import { format } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import { getScheduleColor } from '../model/schedule-color'
import {
  DEFAULT_START_HOUR,
  timeToPosition,
  scheduleHeight,
  isTodoItem
} from '../model/calendar-utils'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'

interface Props {
  schedule: ScheduleItem
  workspaceId: string
  hourHeight: number
  column?: number
  totalColumns?: number
  span?: number
  showTime?: boolean
  showDescription?: boolean
  displayStartAt?: Date
  displayEndAt?: Date
  startHour?: number
  resizable?: boolean
  onResizeStart?: (e: React.PointerEvent, schedule: ScheduleItem, edge: 'top' | 'bottom') => void
}

export function ScheduleBlock({
  schedule,
  workspaceId,
  hourHeight,
  column = 0,
  totalColumns = 1,
  span = 1,
  showTime = false,
  showDescription = false,
  displayStartAt,
  displayEndAt,
  startHour = DEFAULT_START_HOUR,
  resizable,
  onResizeStart
}: Props): React.JSX.Element {
  const color = getScheduleColor(schedule)
  const effectiveStart = displayStartAt ?? schedule.startAt
  const effectiveEnd = displayEndAt ?? schedule.endAt
  const top = timeToPosition(effectiveStart, hourHeight, startHour)
  const height = scheduleHeight(effectiveStart, effectiveEnd, hourHeight)

  const isTodo = isTodoItem(schedule)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${schedule.id}`,
    data: { schedule, type: 'block' }
  })

  const colWidth = 100 / totalColumns
  const widthPercent = colWidth * span
  const leftPercent = column * colWidth

  const style: React.CSSProperties = {
    position: 'absolute',
    top,
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
    height,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <ScheduleDetailPopover schedule={schedule} workspaceId={workspaceId}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        data-block-id={schedule.id}
        className="absolute cursor-pointer rounded-sm flex overflow-hidden"
        style={{
          ...style,
          backgroundColor: `${color}${isTodo ? '08' : '20'}`,
          border: isTodo ? `1.5px dashed ${color}40` : undefined,
          borderLeft: isTodo ? undefined : `4px solid ${color}`
        }}
      >
        <div className="flex-1 min-w-0 px-1 py-0.5">
          <div className="text-[11px] font-medium truncate leading-tight">
            {isTodo && <span className="opacity-60 mr-0.5">☑</span>}
            {schedule.title}
          </div>
          {showTime && (
            <div className="text-[10px] text-muted-foreground truncate">
              {format(schedule.startAt, 'HH:mm')} ~ {format(schedule.endAt, 'HH:mm')}
            </div>
          )}
          {showDescription && schedule.description && (
            <div className="text-[10px] text-muted-foreground truncate">{schedule.description}</div>
          )}
        </div>
        {resizable && (
          <>
            <div
              className="absolute top-0 inset-x-0 h-1.5 cursor-n-resize z-10 group flex items-start justify-center"
              onPointerDown={(e) => {
                e.stopPropagation()
                onResizeStart?.(e, schedule, 'top')
              }}
            >
              <div
                className="w-6 h-[3px] rounded-full opacity-0 group-hover:opacity-60 mt-px"
                style={{ backgroundColor: color }}
              />
            </div>
            <div
              className="absolute bottom-0 inset-x-0 h-1.5 cursor-s-resize z-10 group flex items-end justify-center"
              onPointerDown={(e) => {
                e.stopPropagation()
                onResizeStart?.(e, schedule, 'bottom')
              }}
            >
              <div
                className="w-6 h-[3px] rounded-full opacity-0 group-hover:opacity-60 mb-px"
                style={{ backgroundColor: color }}
              />
            </div>
          </>
        )}
      </div>
    </ScheduleDetailPopover>
  )
}
