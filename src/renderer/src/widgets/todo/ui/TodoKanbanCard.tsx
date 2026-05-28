import { memo, useCallback, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarDays, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Checkbox } from '@shared/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { useUpdateTodo, TODO_STATUS } from '@entities/todo'
import type { TodoItem } from '@entities/todo'
import { DeleteTodoDialog } from '@features/todo/delete-todo/ui/DeleteTodoDialog'
import { LinkedEntityPopoverButton, PanePickerSubmenu } from '@/widgets/entity-link'
import { AuthorBadge } from '@shared/ui/author-badge'

const PRIORITY_STRIP: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-blue-400'
}

function formatDueDate(date: Date): string {
  return new Date(date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

/** 마감일 임박도에 따른 색상 클래스: 오늘/지남=red, 3일 이내=amber, 그 외=muted */
function dueDateTone(date: Date, isDone: boolean): string {
  if (isDone) return 'text-muted-foreground'
  const due = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'text-red-600 dark:text-red-400 font-medium'
  if (diffDays === 0) return 'text-red-600 dark:text-red-400 font-medium'
  if (diffDays <= 3) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
}

interface Props {
  todo: TodoItem
  subTodos: TodoItem[]
  workspaceId: string
  onItemClick: (todoId: string) => void
  onOpenInPane?: (todoId: string, paneId: string) => void
  onItemDelete: (todoId: string) => void
}

function TodoKanbanCardImpl({
  todo,
  subTodos,
  workspaceId,
  onItemClick,
  onOpenInPane,
  onItemDelete
}: Props): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id
  })
  const updateTodo = useUpdateTodo()
  const [isOpen, setIsOpen] = useState(false)
  const doneCount = subTodos.filter((t) => t.isDone).length

  // 이벤트 핸들러는 todo.id 가 같으면 reference 안정 — 자식 DropdownMenu 등 재렌더 방지
  const handleTitleClick = useCallback(() => onItemClick(todo.id), [onItemClick, todo.id])
  const handleDelete = useCallback(() => onItemDelete(todo.id), [onItemDelete, todo.id])
  const handleOpenInPane = useCallback(
    (paneId: string) => onOpenInPane?.(todo.id, paneId),
    [onOpenInPane, todo.id]
  )

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className="relative mb-2 overflow-hidden rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-3"
      >
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${PRIORITY_STRIP[todo.priority] ?? ''}`}
        />
        <div className="flex items-start gap-2 invisible">
          <div className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1 text-sm leading-snug">{todo.title}</span>
        </div>
        {todo.description && (
          <p className="text-sm mt-1.5 pl-6 line-clamp-2 invisible">{todo.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 pl-6 invisible">
          <div className="w-2 h-2 rounded-full shrink-0" />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      data-kanban-card="true"
      className="relative mb-2 overflow-hidden rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing shadow-sm transition-shadow select-none hover:shadow-md hover:bg-muted/40 hover:border-border/80"
      onClick={handleTitleClick}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${PRIORITY_STRIP[todo.priority] ?? ''}`}
      />
      {/* 제목 행 — priority 는 좌측 border 로 표현 */}
      <div className="flex items-start gap-2 min-w-0">
        <Checkbox
          checked={todo.isDone}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(checked) =>
            updateTodo.mutate({ workspaceId, todoId: todo.id, data: { isDone: !!checked } })
          }
          className="mt-0.5 shrink-0"
        />
        <span
          className={`flex-1 min-w-0 text-sm leading-snug break-words ${todo.isDone ? 'line-through text-muted-foreground' : ''}`}
        >
          {todo.title}
        </span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <PanePickerSubmenu onPaneSelect={handleOpenInPane}>
              {({ onClick }) => (
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={onClick}>
                  상세 보기
                </DropdownMenuItem>
              )}
            </PanePickerSubmenu>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>상태 변경</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {TODO_STATUS.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onSelect={() =>
                      updateTodo.mutate({ workspaceId, todoId: todo.id, data: { status: s } })
                    }
                    className={todo.status === s ? 'font-medium' : ''}
                  >
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DeleteTodoDialog
              todoId={todo.id}
              workspaceId={workspaceId}
              hasSubTodos={subTodos.length > 0}
              onDeleted={handleDelete}
              trigger={
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => e.preventDefault()}
                >
                  삭제
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 설명 */}
      {todo.description && (
        <p className="text-sm text-muted-foreground mt-1.5 pl-6 line-clamp-2 break-words">
          {todo.description}
        </p>
      )}

      {/* 푸터: 좌측 — 서브투두 토글 + 마감일 / 우측 — 링크 */}
      <div className="flex items-center gap-2 mt-2 pl-6">
        {subTodos.length > 0 && (
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen((v) => !v)
            }}
          >
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {doneCount}/{subTodos.length}
          </button>
        )}
        {todo.dueDate && (
          <span
            className={`flex items-center gap-1 text-xs ${dueDateTone(todo.dueDate, todo.isDone)}`}
          >
            <CalendarDays className="w-3 h-3 shrink-0" />
            {formatDueDate(todo.dueDate)}
          </span>
        )}
        <span
          className="ml-auto flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <AuthorBadge
            by={todo.updatedBy}
            byId={todo.updatedById}
            at={todo.updatedAt}
            size="sm"
          />
          <LinkedEntityPopoverButton
            entityType="todo"
            entityId={todo.id}
            workspaceId={workspaceId}
          />
        </span>
      </div>

      {/* 서브 할 일 목록 */}
      {isOpen && subTodos.length > 0 && (
        <div className="mt-2 pl-6 flex flex-col gap-1">
          {subTodos.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2">
              <Checkbox
                checked={sub.isDone}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={(checked) =>
                  updateTodo.mutate({ workspaceId, todoId: sub.id, data: { isDone: !!checked } })
                }
                className="shrink-0"
              />
              <span
                className={`flex-1 min-w-0 text-xs truncate ${sub.isDone ? 'line-through text-muted-foreground' : ''}`}
              >
                {sub.title}
              </span>
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <LinkedEntityPopoverButton
                  entityType="todo"
                  entityId={sub.id}
                  workspaceId={workspaceId}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const TodoKanbanCard = memo(TodoKanbanCardImpl)

// DragOverlay 전용 — DnD 훅 없이 순수 시각만 렌더링
export function TodoKanbanCardOverlay({
  todo,
  subTodos
}: {
  todo: TodoItem
  subTodos: TodoItem[]
}): React.JSX.Element {
  const doneCount = subTodos.filter((t) => t.isDone).length

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-3 shadow-xl cursor-grabbing select-none rotate-1 opacity-95 w-72">
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${PRIORITY_STRIP[todo.priority] ?? ''}`}
      />
      <div className="flex items-start gap-2 min-w-0">
        <Checkbox checked={todo.isDone} disabled className="mt-0.5 shrink-0" />
        <span
          className={`flex-1 text-sm leading-snug break-words ${todo.isDone ? 'line-through text-muted-foreground' : ''}`}
        >
          {todo.title}
        </span>
      </div>
      {todo.description && (
        <p className="text-sm text-muted-foreground mt-1.5 pl-6 line-clamp-2 break-words">
          {todo.description}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2 pl-6">
        {subTodos.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronRight className="w-3 h-3" />
            {doneCount}/{subTodos.length}
          </span>
        )}
        {todo.dueDate && (
          <span
            className={`flex items-center gap-1 text-xs ${dueDateTone(todo.dueDate, todo.isDone)}`}
          >
            <CalendarDays className="w-3 h-3 shrink-0" />
            {formatDueDate(todo.dueDate)}
          </span>
        )}
      </div>
    </div>
  )
}
