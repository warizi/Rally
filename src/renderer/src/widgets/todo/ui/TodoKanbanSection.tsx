import { CollapsibleSection } from '@shared/ui/collapsible-section'
import { TodoKanbanView } from '@features/todo/todo-kanban/ui/TodoKanbanView'
import type { TodoItem, TodoStatus } from '@entities/todo'

interface Props {
  todos: TodoItem[]
  subTodoMap: Map<string, TodoItem[]>
  columnMap: Map<TodoStatus, TodoItem[]>
  workspaceId: string
  filterActive: boolean
  activeColumn: number
  onColumnChange: (i: number) => void
  onItemClick: (todoId: string) => void
  onOpenInPane?: (todoId: string, paneId: string) => void
  onItemDelete: (todoId: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TodoKanbanSection({
  todos,
  subTodoMap,
  columnMap,
  workspaceId,
  filterActive,
  activeColumn,
  onColumnChange,
  onItemClick,
  onOpenInPane,
  onItemDelete,
  open,
  onOpenChange
}: Props): React.JSX.Element {
  return (
    <CollapsibleSection
      title="칸반 보기"
      className="flex-1 min-h-0 flex flex-col"
      contentClassName="flex-1 min-h-0"
      open={open}
      onOpenChange={onOpenChange}
    >
      <TodoKanbanView
        todos={todos}
        subTodoMap={subTodoMap}
        columnMap={columnMap}
        workspaceId={workspaceId}
        filterActive={filterActive}
        activeColumn={activeColumn}
        onColumnChange={onColumnChange}
        onItemClick={onItemClick}
        onOpenInPane={onOpenInPane}
        onItemDelete={onItemDelete}
      />
    </CollapsibleSection>
  )
}
