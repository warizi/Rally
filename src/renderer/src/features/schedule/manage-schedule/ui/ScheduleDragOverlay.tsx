import { DragOverlay } from '@dnd-kit/core'
import { format } from 'date-fns'
import type { ScheduleItem } from '@entities/schedule'
import { getScheduleColor } from '../model/schedule-color'

export type DragItemType = 'bar' | 'single' | 'block'

interface Props {
  activeSchedule: ScheduleItem | null
  activeType?: DragItemType
  activeWidth?: number
  activeHeight?: number
}

export function ScheduleDragOverlay({
  activeSchedule,
  activeType = 'block',
  activeWidth,
  activeHeight
}: Props): React.JSX.Element | null {
  if (!activeSchedule) return null

  const color = getScheduleColor(activeSchedule)

  return (
    <DragOverlay dropAnimation={null}>
      {activeType === 'bar' ? (
        <div
          className="rounded-sm px-1 text-[10px] leading-[20px] font-medium truncate cursor-grabbing shadow-lg"
          style={{ backgroundColor: `${color}20`, color, height: 20, width: activeWidth }}
        >
          {activeSchedule.title}
        </div>
      ) : activeType === 'single' ? (
        <div
          className="rounded px-1 py-px text-[10px] font-medium truncate max-w-48 cursor-grabbing shadow-lg"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {activeSchedule.title}
        </div>
      ) : (
        <div
          className="rounded-sm flex cursor-grabbing shadow-lg overflow-hidden"
          style={{ backgroundColor: `${color}20`, width: activeWidth, height: activeHeight }}
        >
          <div className="shrink-0 w-[4px] rounded-l-sm" style={{ backgroundColor: color }} />
          <div className="flex-1 min-w-0 px-1 py-0.5">
            <div className="text-[11px] font-medium truncate">{activeSchedule.title}</div>
            {!activeSchedule.allDay && (
              <div className="text-[10px] text-muted-foreground truncate">
                {format(activeSchedule.startAt, 'HH:mm')} ~ {format(activeSchedule.endAt, 'HH:mm')}
              </div>
            )}
          </div>
        </div>
      )}
    </DragOverlay>
  )
}
