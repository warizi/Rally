import { useDraggable } from '@dnd-kit/core'
import type { ScheduleItem } from '@entities/schedule'
import { BAR_GAP } from '../model/calendar-constants'
import { getItemStyle } from '../model/schedule-style'
import { isTodoItem } from '../model/calendar-predicates'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'

interface Props {
  schedule: ScheduleItem
  workspaceId: string
  startCol: number
  span: number
  lane: number
  isStart: boolean
  isEnd: boolean
  barHeight: number
  draggableId: string
  draggableData?: Record<string, unknown>
  onGrab: (offset: number, width?: number) => void
  wrapperClassName?: string
}

export function ScheduleBarItem({
  schedule,
  workspaceId,
  startCol,
  span,
  lane,
  isStart,
  isEnd,
  barHeight,
  draggableId,
  draggableData,
  onGrab,
  wrapperClassName
}: Props): React.JSX.Element {
  const style = getItemStyle(schedule)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableId,
    data: { schedule, type: 'bar', ...draggableData }
  })

  function handlePointerDown(e: React.PointerEvent): void {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const colWidth = rect.width / span
    const offset = Math.floor(clickX / colWidth)
    onGrab(offset, rect.width)
    ;(listeners as Record<string, (e: React.PointerEvent) => void>)?.onPointerDown?.(e)
  }

  const inner = (
    <ScheduleDetailPopover schedule={schedule} workspaceId={workspaceId}>
      <div
        ref={setNodeRef}
        {...attributes}
        onPointerDown={handlePointerDown}
        className={`absolute cursor-pointer text-[10px] px-1 truncate ${
          isStart ? 'rounded-l-sm' : ''
        } ${isEnd ? 'rounded-r-sm' : ''}`}
        style={{
          lineHeight: `${barHeight}px`,
          top: lane * (barHeight + BAR_GAP),
          left: `${(startCol / 7) * 100}%`,
          width: `${(span / 7) * 100}%`,
          height: barHeight,
          ...style,
          opacity: isDragging ? 0.4 : schedule.isDone ? 0.5 : 1
        }}
      >
        {isTodoItem(schedule) && (
          <span className="opacity-60 mr-0.5">{schedule.isDone ? '☑' : '☐'}</span>
        )}
        <span className={schedule.isDone ? 'line-through' : ''}>{schedule.title}</span>
      </div>
    </ScheduleDetailPopover>
  )

  return wrapperClassName ? <div className={wrapperClassName}>{inner}</div> : inner
}
