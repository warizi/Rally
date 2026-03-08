import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { TodoItem, TodoStatus } from '@entities/todo'
import { TodoKanbanCard } from './TodoKanbanCard'
import { CreateTodoDialog } from '@features/todo/create-todo/ui/CreateTodoDialog'
import { Button } from '@shared/ui/button'
import { ScrollArea } from '@/shared/ui/scroll-area'

interface Props {
  status: TodoStatus
  todos: TodoItem[]
  subTodoMap: Map<string, TodoItem[]>
  workspaceId: string
  onItemClick: (todoId: string) => void
  onOpenInPane?: (todoId: string, paneId: string) => void
  onItemDelete: (todoId: string) => void
  className?: string
}

const STATUS_LABEL: Record<TodoStatus, string> = {
  할일: '할일',
  진행중: '진행중',
  완료: '완료',
  보류: '보류'
}

export function TodoKanbanBoard({
  status,
  todos,
  subTodoMap,
  workspaceId,
  onItemClick,
  onOpenInPane,
  onItemDelete,
  className
}: Props): React.JSX.Element {
  const { setNodeRef } = useDroppable({ id: status })

  return (
    <div className={`flex flex-col shrink-0 h-full ${className ?? 'w-72'}`}>
      <div className="flex flex-col h-full rounded-xl border border-border bg-muted/30">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {STATUS_LABEL[status]}
          </span>
          <span className="text-xs font-medium text-muted-foreground bg-background rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {todos.length}
          </span>
        </div>

        {/* 카드 목록 */}
        <div
          ref={setNodeRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-area-w-content-fit"
        >
          <ScrollArea className="w-full min-w-0 flex-1">
            <div className="px-2 pb-2">
              <SortableContext
                items={todos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {todos.map((todo) => (
                  <TodoKanbanCard
                    key={todo.id}
                    todo={todo}
                    subTodos={subTodoMap.get(todo.id) ?? []}
                    workspaceId={workspaceId}
                    onTitleClick={() => onItemClick(todo.id)}
                    onOpenInPane={
                      onOpenInPane ? (paneId) => onOpenInPane(todo.id, paneId) : undefined
                    }
                    onDelete={() => onItemDelete(todo.id)}
                  />
                ))}
              </SortableContext>

              {todos.length === 0 && (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
                  없음
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 추가 버튼 */}
        <div className="px-2 pb-2 shrink-0">
          <CreateTodoDialog
            workspaceId={workspaceId}
            defaultStatus={status}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground/70 hover:text-muted-foreground text-sm h-8"
              >
                + 추가
              </Button>
            }
          />
        </div>
      </div>
    </div>
  )
}
