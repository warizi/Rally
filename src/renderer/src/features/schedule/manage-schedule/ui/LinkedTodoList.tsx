import { CheckCircle2, Circle, Link2Off, Plus } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { Button } from '@shared/ui/button'
import { useLinkedTodos, useUnlinkTodo } from '@entities/schedule'
import { TodoLinkPopover } from './TodoLinkPopover'

interface Props {
  scheduleId: string
  workspaceId: string
  compact?: boolean
}

export function LinkedTodoList({
  scheduleId,
  workspaceId,
  compact = false
}: Props): React.JSX.Element {
  const { data: linkedTodos = [] } = useLinkedTodos(scheduleId)
  const unlinkTodo = useUnlinkTodo()

  const displayed = compact ? linkedTodos.slice(0, 3) : linkedTodos

  function handleUnlink(todoId: string): void {
    unlinkTodo.mutate({ scheduleId, todoId })
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">연결된 할 일</span>
        <TodoLinkPopover
          scheduleId={scheduleId}
          workspaceId={workspaceId}
          linkedTodoIds={linkedTodos.map((t) => t.id)}
        >
          <Button variant="ghost" size="icon-xs">
            <Plus className="size-3.5" />
          </Button>
        </TodoLinkPopover>
      </div>

      {displayed.length === 0 ? (
        <div className="text-xs text-muted-foreground">연결된 할 일이 없습니다</div>
      ) : (
        <div className="space-y-0.5">
          {displayed.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center justify-between text-xs rounded px-1 py-0.5 hover:bg-accent group"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {todo.isDone ? (
                  <CheckCircle2 className="size-3 shrink-0 text-muted-foreground" />
                ) : (
                  <Circle className="size-3 shrink-0 text-muted-foreground" />
                )}
                <span className={cn('truncate', todo.isDone && 'line-through text-muted-foreground')}>
                  {todo.title}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => handleUnlink(todo.id)}
              >
                <Link2Off className="size-3" />
              </Button>
            </div>
          ))}
          {compact && linkedTodos.length > 3 && (
            <div className="text-[10px] text-muted-foreground px-1">
              +{linkedTodos.length - 3}개 더
            </div>
          )}
        </div>
      )}
    </div>
  )
}
