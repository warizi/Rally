import { useUpdateTodo } from '@entities/todo'
import type { TodoItem } from '@entities/todo'
import { TodoCheckbox } from '@features/todo/todo-field/ui/TodoCheckbox'
import { TodoStatusSelect } from '@features/todo/todo-field/ui/TodoStatusSelect'
import { TodoPrioritySelect } from '@features/todo/todo-field/ui/TodoPrioritySelect'
import { DatePickerButton } from '@shared/ui/date-picker-button'

interface Props {
  todo: TodoItem
  workspaceId: string
}

function Label({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-row gap-4 items-center h-6 min-w-[240px]">
      <span className="text-muted-foreground w-[50px]">{title}</span>
      {children}
    </div>
  )
}

export function TodoDetailFields({ todo, workspaceId }: Props): React.JSX.Element {
  const updateTodo = useUpdateTodo()

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid grid-cols-1 gap-4 @[550px]:grid-cols-2 w-fit">
        {/* isDone */}
        <Label title="완료">
          <TodoCheckbox
            todoId={todo.id}
            workspaceId={workspaceId}
            checked={todo.isDone}
            title={todo.title}
          />
        </Label>
      </div>
      <div className="grid grid-cols-1 gap-4 @[550px]:grid-cols-2 w-fit">
        {/* startDate */}
        <Label title="시작일">
          <DatePickerButton
            value={todo.startDate ? new Date(todo.startDate) : null}
            onChange={(date) => {
              if (date && todo.startDate) {
                const prev = new Date(todo.startDate)
                date.setHours(prev.getHours(), prev.getMinutes(), prev.getSeconds(), 0)
              }
              updateTodo.mutate({ workspaceId, todoId: todo.id, data: { startDate: date } })
            }}
            placeholder="날짜 없음"
            className="min-w-[140px]"
          />
        </Label>

        {/* dueDate */}
        <Label title="마감일">
          <DatePickerButton
            value={todo.dueDate ? new Date(todo.dueDate) : null}
            onChange={(date) => {
              if (date && todo.dueDate) {
                const prev = new Date(todo.dueDate)
                date.setHours(prev.getHours(), prev.getMinutes(), prev.getSeconds(), 0)
              }
              updateTodo.mutate({ workspaceId, todoId: todo.id, data: { dueDate: date } })
            }}
            placeholder="날짜 없음"
            className="min-w-[140px]"
          />
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-4 @[550px]:grid-cols-2 w-fit">
        {/* status */}
        <Label title="상태">
          <TodoStatusSelect
            value={todo.status}
            onChange={(status) =>
              updateTodo.mutate({ workspaceId, todoId: todo.id, data: { status } })
            }
          />
        </Label>

        {/* priority */}
        <Label title="중요도">
          <TodoPrioritySelect
            value={todo.priority}
            onChange={(priority) =>
              updateTodo.mutate({ workspaceId, todoId: todo.id, data: { priority } })
            }
          />
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-4 @[550px]:grid-cols-2 w-fit">
        {/* 생성일 */}
        <Label title="생성일">
          <span className="text-muted-foreground">
            {new Date(todo.createdAt).toLocaleDateString('ko-KR')}
          </span>
        </Label>

        {/* 완료일 */}
        {todo.doneAt && (
          <Label title="완료일">
            <span className="text-muted-foreground">
              {new Date(todo.doneAt).toLocaleDateString('ko-KR')}
            </span>
          </Label>
        )}
      </div>
    </div>
  )
}
