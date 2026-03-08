import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import type { TodoStatus } from '@entities/todo'

interface Props {
  value: TodoStatus
  onChange: (value: TodoStatus) => void
}

export function TodoStatusSelect({ value, onChange }: Props): React.JSX.Element {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TodoStatus)}>
      <SelectTrigger className="h-6 w-[140px]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="할일">할일</SelectItem>
        <SelectItem value="진행중">진행중</SelectItem>
        <SelectItem value="완료">완료</SelectItem>
        <SelectItem value="보류">보류</SelectItem>
      </SelectContent>
    </Select>
  )
}
