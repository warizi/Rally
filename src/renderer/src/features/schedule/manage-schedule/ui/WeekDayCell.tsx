import { useDroppable, useDraggable } from '@dnd-kit/core'
import { format } from 'date-fns'
import { Check, Circle } from 'lucide-react'
import type { ScheduleItem } from '@entities/schedule'
import { isScheduleOnDate, isTodoItem } from '../model/calendar-predicates'
import { getScheduleColor } from '../model/schedule-color'
import { getItemStyle } from '../model/schedule-style'
import { ScheduleDetailPopover } from './ScheduleDetailPopover'

interface Props {
  date: Date
  dayIdx: number
  schedules: ScheduleItem[]
  workspaceId: string
  barAreaHeight: number
  activeSchedule: ScheduleItem | null
}

export function WeekDayCell({
  date,
  dayIdx,
  schedules,
  workspaceId,
  barAreaHeight,
  activeSchedule
}: Props): React.JSX.Element {
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
              className="flex items-center gap-0.5 text-[10px] @[800px]:text-[11px] truncate rounded px-1 py-px cursor-pointer"
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
              {!s.allDay && (
                <span className="hidden @[800px]:inline">{format(s.startAt, 'HH:mm')} </span>
              )}
              <span className={s.isDone ? 'line-through opacity-60' : ''}>{s.title}</span>
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
