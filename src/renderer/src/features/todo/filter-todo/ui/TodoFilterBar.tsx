import { X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Button } from '@shared/ui/button'
import { DatePickerButton } from '@shared/ui/date-picker-button'
import { DEFAULT_FILTER, isFilterActive } from '@features/todo/filter-todo/model/todo-filter'
import type { TodoFilter } from '@features/todo/filter-todo/model/todo-filter'

interface Props {
  filter: TodoFilter
  onFilterChange: (filter: TodoFilter) => void
  showStatus?: boolean
}

export function TodoFilterBar({
  filter,
  onFilterChange,
  showStatus = true
}: Props): React.JSX.Element {
  const active = isFilterActive(filter)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-row gap-2">
        {showStatus && (
          <Select
            value={filter.status}
            onValueChange={(v) => onFilterChange({ ...filter, status: v as TodoFilter['status'] })}
          >
            <SelectTrigger className="h-8 w-[120px]" size="sm">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="할일">할일</SelectItem>
              <SelectItem value="진행중">진행중</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select
          value={filter.priority}
          onValueChange={(v) =>
            onFilterChange({ ...filter, priority: v as TodoFilter['priority'] })
          }
        >
          <SelectTrigger className="h-8 w-[120px]" size="sm">
            <SelectValue placeholder="중요도" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 중요도</SelectItem>
            <SelectItem value="high">높음</SelectItem>
            <SelectItem value="medium">보통</SelectItem>
            <SelectItem value="low">낮음</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-row gap-2">
        <DatePickerButton
          value={filter.startDateFrom}
          onChange={(date) => onFilterChange({ ...filter, startDateFrom: date })}
          placeholder="시작일 시작"
          className="w-[120px]"
        />

        <DatePickerButton
          value={filter.startDateTo}
          onChange={(date) => onFilterChange({ ...filter, startDateTo: date })}
          placeholder="시작일 종료"
          className="w-[120px]"
        />
      </div>
      <div className="flex flex-row gap-2">
        <DatePickerButton
          value={filter.dueDateFrom}
          onChange={(date) => onFilterChange({ ...filter, dueDateFrom: date })}
          placeholder="마감일 시작"
          className="w-[120px]"
        />

        <DatePickerButton
          value={filter.dueDateTo}
          onChange={(date) => onFilterChange({ ...filter, dueDateTo: date })}
          placeholder="마감일 종료"
          className="w-[120px]"
        />
      </div>

      {active && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => onFilterChange(DEFAULT_FILTER)}
          title="필터 초기화"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
