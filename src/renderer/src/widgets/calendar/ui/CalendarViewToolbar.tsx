import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group'
import type { CalendarViewType } from '@features/schedule/manage-schedule'

interface Props {
  viewType: CalendarViewType
  onViewTypeChange: (type: CalendarViewType) => void
}

export function CalendarViewToolbar({ viewType, onViewTypeChange }: Props): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      value={viewType}
      onValueChange={(v) => v && onViewTypeChange(v as CalendarViewType)}
      size="sm"
      variant="outline"
    >
      <ToggleGroupItem value="month">월</ToggleGroupItem>
      <ToggleGroupItem value="week">주</ToggleGroupItem>
      <ToggleGroupItem value="day">일</ToggleGroupItem>
    </ToggleGroup>
  )
}
