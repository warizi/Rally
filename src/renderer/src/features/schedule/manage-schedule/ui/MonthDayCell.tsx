import { useDroppable } from '@dnd-kit/core'
import { isSameDay, format } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import type { MonthGridDay } from '../model/calendar-utils'
import { getScheduleColor } from '../model/schedule-color'

interface Props {
  day: MonthGridDay
  isSelected: boolean
  onClick: (date: Date) => void
  children: React.ReactNode
  previewSchedule?: ScheduleItem | null
}

export function MonthDayCell({ day, isSelected, onClick, children, previewSchedule }: Props): React.JSX.Element {
  const dateKey = format(day.date, 'yyyy-MM-dd')
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date: day.date },
  })

  const today = isSameDay(day.date, new Date())

  return (
    <div
      ref={setNodeRef}
      className={`
        border-b border-r border-border p-1 overflow-hidden cursor-pointer relative
        ${!day.isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''}
        ${today ? 'bg-primary/5' : ''}
        ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
        ${isOver ? 'bg-accent' : ''}
      `}
      onClick={() => onClick(day.date)}
    >
      <div className="flex justify-end">
        <span
          className={`
            text-xs
            ${
              today
                ? 'bg-primary text-primary-foreground rounded-full size-4 leading-4 text-center inline-block text-[10px]'
                : ''
            }
          `}
        >
          {day.date.getDate()}
        </span>
      </div>
      {children}

      {/* DnD drop preview */}
      {isOver && previewSchedule && (
        <div
          className="text-[10px] truncate rounded px-0.5 py-px pointer-events-none mt-0.5"
          style={{
            backgroundColor: `${getScheduleColor(previewSchedule)}15`,
            border: `1.5px dashed ${getScheduleColor(previewSchedule)}60`,
            color: getScheduleColor(previewSchedule),
          }}
        >
          {previewSchedule.title}
        </div>
      )}
    </div>
  )
}
