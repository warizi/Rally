import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@shared/ui/button'
import type { TodoItem } from '@entities/todo'
import { CreateTodoDialog } from '@features/todo/create-todo/ui/CreateTodoDialog'
import { SubTodoListView } from '@features/todo/todo-field/ui/SubTodoListView'

interface Props {
  todo: TodoItem
  subTodos: TodoItem[]
  workspaceId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function SubTodoSection({
  todo,
  subTodos,
  workspaceId,
  isOpen,
  onOpenChange
}: Props): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          className="flex items-center gap-1 text-sm font-medium hover:text-foreground text-foreground transition-colors"
          onClick={() => onOpenChange(!isOpen)}
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          하위 할 일{subTodos.length > 0 ? ` (${subTodos.length})` : ''}
        </button>
        <CreateTodoDialog
          workspaceId={workspaceId}
          parentId={todo.id}
          trigger={
            <Button variant="outline" size="sm">
              + 하위 할 일 추가
            </Button>
          }
        />
      </div>
      {isOpen && (
        <SubTodoListView subTodos={subTodos} workspaceId={workspaceId} parentId={todo.id} />
      )}
    </div>
  )
}
