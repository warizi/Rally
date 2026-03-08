import type { ScheduleItem } from '@entities/schedule'
import { getScheduleColor } from './schedule-color'
import { isTodoItem } from './calendar-predicates'

export function getItemStyle(schedule: ScheduleItem): React.CSSProperties {
  const color = getScheduleColor(schedule)
  const todo = isTodoItem(schedule)
  return {
    backgroundColor: `${color}${todo ? '08' : '20'}`,
    border: todo ? `1.5px dashed ${color}40` : undefined
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
