import type { ScheduleItem } from '@entities/schedule'
import { getScheduleColor } from './schedule-color'
import { isTodoItem } from './calendar-predicates'

export function getItemStyle(schedule: ScheduleItem): React.CSSProperties {
  const color = getScheduleColor(schedule)
  const todo = isTodoItem(schedule)
  return {
    backgroundColor: todo ? 'transparent' : `${color}20`,
    border: todo ? `1px solid ${color}50` : undefined,
    color
  }
}

export function getItemDotStyle(schedule: ScheduleItem): React.CSSProperties {
  const color = getScheduleColor(schedule)
  const todo = isTodoItem(schedule)
  return {
    backgroundColor: todo ? 'transparent' : color,
    border: todo ? `1.5px solid ${color}` : undefined
  }
}
