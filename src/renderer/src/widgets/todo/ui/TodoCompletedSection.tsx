import { CollapsibleSection } from '@shared/ui/collapsible-section'
import { TodoCompletedView } from '@features/todo/todo-list/ui/TodoCompletedView'
import type { TodoItem } from '@entities/todo'

interface Props {
  todos: TodoItem[]
  workspaceId: string
  filterActive: boolean
  onItemClick: (todoId: string) => void
  onOpenInPane?: (todoId: string, paneId: string) => void
  onItemDeleted?: (todoId: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TodoCompletedSection({
  todos,
  workspaceId,
  filterActive,
  onItemClick,
  onOpenInPane,
  onItemDeleted,
  open,
  onOpenChange
}: Props): React.JSX.Element {
  return (
    <CollapsibleSection
      title={`완료된 항목 (${todos.length}개)`}
      open={open}
      onOpenChange={onOpenChange}
    >
      <TodoCompletedView
        todos={todos}
        workspaceId={workspaceId}
        filterActive={filterActive}
        onItemClick={onItemClick}
        onOpenInPane={onOpenInPane}
        onItemDeleted={onItemDeleted}
      />
    </CollapsibleSection>
  )
}
