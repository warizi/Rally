import { useDraggable } from '@dnd-kit/core'
import type { ScheduleItem } from '@entities/schedule'
import { getScheduleColor } from '../model/schedule-color'
import { isTodoItem } from '../model/calendar-utils'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'

interface Props {
  schedule: ScheduleItem
  workspaceId: string
  startCol: number
  span: number
  lane: number
  isStart: boolean
  isEnd: boolean
  barHeight?: number
  gap?: number
}

export function ScheduleBar({
  schedule,
  workspaceId,
  startCol,
  span,
  lane,
  isStart,
  isEnd,
  barHeight = 20,
  gap = 2
}: Props): React.JSX.Element {
  const color = getScheduleColor(schedule)

  const isTodo = isTodoItem(schedule)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bar-${schedule.id}`,
    data: { schedule, type: 'bar' }
  })

  const style: React.CSSProperties = {
    position: 'absolute',
    top: lane * (barHeight + gap),
    left: `${(startCol / 7) * 100}%`,
    width: `${(span / 7) * 100}%`,
    height: barHeight,
    backgroundColor: isTodo ? 'transparent' : `${color}20`,
    border: isTodo ? `1px solid ${color}50` : undefined,
    color,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <ScheduleDetailPopover schedule={schedule} workspaceId={workspaceId}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`
          cursor-pointer text-[10px] leading-[20px] px-1 truncate
          ${isStart ? 'rounded-l-sm' : ''}
          ${isEnd ? 'rounded-r-sm' : ''}
        `}
        style={style}
      >
        {isTodo && <span className="opacity-60 mr-0.5">☑</span>}
        {schedule.title}
      </div>
    </ScheduleDetailPopover>
  )
}
