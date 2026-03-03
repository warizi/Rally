import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useUpdateTodo, useTodosByWorkspace } from '@entities/todo'
import type { TodoStatus, TodoPriority } from '@entities/todo'
import { TodoCheckbox } from '@features/todo/todo-field/ui/TodoCheckbox'
import { TodoStatusSelect } from '@features/todo/todo-field/ui/TodoStatusSelect'
import { TodoPrioritySelect } from '@features/todo/todo-field/ui/TodoPrioritySelect'
import { SubTodoListView } from '@features/todo/todo-field/ui/SubTodoListView'
import type { NodeContentProps } from '../../model/node-content-registry'

export function TodoNodeContent({ refId, refTitle }: NodeContentProps): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId) ?? ''
  const { data: todos = [] } = useTodosByWorkspace(workspaceId)
  const updateTodo = useUpdateTodo()

  const todo = todos.find((t) => t.id === refId)
  const subTodos = useMemo(
    () => todos.filter((t) => t.parentId === refId).sort((a, b) => a.subOrder - b.subOrder),
    [todos, refId]
  )

  if (!todo) {
    return (
      <div className="p-3 flex-1 text-sm">
        <p className="font-medium truncate">{refTitle || '(제목 없음)'}</p>
      </div>
    )
  }

  return (
    <div className="p-3 flex-1 min-h-0 overflow-y-auto nowheel flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TodoCheckbox
          todoId={todo.id}
          workspaceId={workspaceId}
          checked={todo.isDone}
          title={todo.title}
        />
        <p
          className={`text-sm font-medium truncate ${todo.isDone ? 'line-through text-muted-foreground' : ''}`}
        >
          {todo.title}
        </p>
      </div>

      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-10 shrink-0">상태</span>
          <TodoStatusSelect
            value={todo.status}
            onChange={(status: TodoStatus) =>
              updateTodo.mutate({ workspaceId, todoId: todo.id, data: { status } })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-10 shrink-0">중요도</span>
          <TodoPrioritySelect
            value={todo.priority}
            onChange={(priority: TodoPriority) =>
              updateTodo.mutate({ workspaceId, todoId: todo.id, data: { priority } })
            }
          />
        </div>
        {todo.dueDate && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="size-3" />
            <span>
              {new Date(todo.dueDate).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric'
              })}
            </span>
          </div>
        )}
      </div>

      {todo.description && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
          {todo.description}
        </p>
      )}

      <SubTodoListView subTodos={subTodos} workspaceId={workspaceId} parentId={todo.id} />
    </div>
  )
}
