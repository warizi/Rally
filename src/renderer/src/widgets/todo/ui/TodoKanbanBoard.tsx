import { memo, useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { TodoItem, TodoStatus } from '@entities/todo'
import { TodoKanbanCard } from './TodoKanbanCard'
import { CreateTodoDialog } from '@features/todo/create-todo/ui/CreateTodoDialog'
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

// 빈 서브투두 배열을 매번 만들지 않도록 모듈 상수 reference 재사용
const EMPTY_TODOS: TodoItem[] = []

const STATUS_ACCENT: Record<TodoStatus, { dot: string; badge: string }> = {
  할일: { dot: 'bg-muted-foreground/40', badge: 'bg-background text-muted-foreground' },
  진행중: { dot: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  완료: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  },
  보류: { dot: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' }
}

function TodoKanbanBoardImpl({
  status,
  todos,
  subTodoMap,
  workspaceId,
  onItemClick,
  onOpenInPane,
  onItemDelete,
  className
}: Props): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const accent = STATUS_ACCENT[status]
  // SortableContext.items 는 reference 안정이 중요 — todos array 변경 시에만 새로 계산
  const sortableIds = useMemo(() => todos.map((t) => t.id), [todos])

  return (
    <div className={`flex flex-col shrink-0 h-full ${className ?? 'w-72'}`}>
      <div
        className={`flex flex-col h-full rounded-xl border bg-muted/30 transition-colors ${
          isOver ? 'border-primary/60 bg-primary/5' : 'border-border'
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2.5 shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${accent.dot}`} />
            <span className="text-sm font-semibold text-foreground truncate">
              {STATUS_LABEL[status]}
            </span>
            <span
              className={`text-xs font-medium rounded-full px-1.5 py-0.5 min-w-[20px] text-center shrink-0 ${accent.badge}`}
            >
              {todos.length}
            </span>
          </div>
          <CreateTodoDialog
            workspaceId={workspaceId}
            defaultStatus={status}
            trigger={
              <button
                className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="할 일 추가"
              >
                <Plus className="w-4 h-4" />
              </button>
            }
          />
        </div>

        {/* 카드 목록 — 세로 스크롤은 ScrollArea 가 전담 (외부 div 는 dnd-kit droppable 컨테이너 역할만) */}
        <div ref={setNodeRef} className="flex-1 min-h-0">
          <ScrollArea className="h-full w-full min-w-0 scroll-area-w-content-fit">
            <div className="px-2 pb-2">
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {todos.map((todo) => (
                  <TodoKanbanCard
                    key={todo.id}
                    todo={todo}
                    subTodos={subTodoMap.get(todo.id) ?? EMPTY_TODOS}
                    workspaceId={workspaceId}
                    onItemClick={onItemClick}
                    onOpenInPane={onOpenInPane}
                    onItemDelete={onItemDelete}
                  />
                ))}
              </SortableContext>

              {todos.length === 0 && (
                <CreateTodoDialog
                  workspaceId={workspaceId}
                  defaultStatus={status}
                  trigger={
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-1.5 py-6 rounded-md border border-dashed border-muted-foreground/30 text-xs text-muted-foreground/70 hover:text-foreground hover:border-muted-foreground/60 hover:bg-muted/40 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />새 할 일
                    </button>
                  }
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

export const TodoKanbanBoard = memo(TodoKanbanBoardImpl)
