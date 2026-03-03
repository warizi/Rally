import { CollapsibleSection } from '@shared/ui/collapsible-section'
import { TodoListView } from '@features/todo/todo-list/ui/TodoListView'
import type { TodoItem } from '@entities/todo'

interface Props {
  todos: TodoItem[]
  subTodoMap: Map<string, TodoItem[]>
  workspaceId: string
  filterActive: boolean
  onItemClick: (todoId: string) => void
  onOpenInPane?: (todoId: string, paneId: string) => void
  onItemDeleted?: (todoId: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TodoListSection({
  todos,
  subTodoMap,
  workspaceId,
  filterActive,
  onItemClick,
  onOpenInPane,
  onItemDeleted,
  open,
  onOpenChange
}: Props): React.JSX.Element {
  return (
    <CollapsibleSection title="목록" open={open} onOpenChange={onOpenChange}>
      <TodoListView
        todos={todos}
        subTodoMap={subTodoMap}
        workspaceId={workspaceId}
        filterActive={filterActive}
        onItemClick={onItemClick}
        onOpenInPane={onOpenInPane}
        onItemDeleted={onItemDeleted}
      />
    </CollapsibleSection>
  )
}
