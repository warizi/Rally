import type { ScheduleItem } from '@entities/schedule'
import { getScheduleColor } from '../model/schedule-color'

interface Props {
  schedule: ScheduleItem
}

export function ScheduleDot({ schedule }: Props): React.JSX.Element {
  const color = getScheduleColor(schedule)
  return (
    <div
      className="size-1.5 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      title={schedule.title}
    />
  )
}
