import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import type { TodoPriority } from '@entities/todo'

const PRIORITY_LABEL: Record<TodoPriority, string> = { high: '높음', medium: '보통', low: '낮음' }

interface Props {
  value: TodoPriority
  onChange: (value: TodoPriority) => void
}

export function TodoPrioritySelect({ value, onChange }: Props): React.JSX.Element {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TodoPriority)}>
      <SelectTrigger className="h-8 w-[140px]" size="sm">
        <SelectValue>{PRIORITY_LABEL[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="high">높음</SelectItem>
        <SelectItem value="medium">보통</SelectItem>
        <SelectItem value="low">낮음</SelectItem>
      </SelectContent>
    </Select>
  )
}
