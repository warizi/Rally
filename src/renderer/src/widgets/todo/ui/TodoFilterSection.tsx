import { CollapsibleSection } from '@shared/ui/collapsible-section'
import { TodoFilterBar } from '@features/todo/filter-todo/ui/TodoFilterBar'
import type { TodoFilter } from '@features/todo/filter-todo/model/todo-filter'

interface Props {
  filter: TodoFilter
  onFilterChange: (filter: TodoFilter) => void
  showStatus?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TodoFilterSection({
  filter,
  onFilterChange,
  showStatus,
  open,
  onOpenChange
}: Props): React.JSX.Element {
  return (
    <CollapsibleSection title="필터" className="shrink-0" open={open} onOpenChange={onOpenChange}>
      <TodoFilterBar filter={filter} onFilterChange={onFilterChange} showStatus={showStatus} />
    </CollapsibleSection>
  )
}
