import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
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
import { LinkedEntityPopoverButton, PanePickerSubmenu } from '@features/entity-link/manage-link'

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400'
}

function formatDueDate(date: Date): string {
  return new Date(date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

interface Props {
  todo: TodoItem
  subTodos: TodoItem[]
  workspaceId: string
  onTitleClick: () => void
  onOpenInPane?: (paneId: string) => void
  onDelete: () => void
}

export function TodoKanbanCard({
  todo,
  subTodos,
  workspaceId,
  onTitleClick,
  onOpenInPane,
  onDelete
}: Props): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id
  })
  const updateTodo = useUpdateTodo()
  const [isOpen, setIsOpen] = useState(false)
  const doneCount = subTodos.filter((t) => t.isDone).length

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className="mb-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-3"
      >
        <div className="flex items-start gap-2 invisible">
          <div className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" />
          <span className="flex-1 text-sm leading-snug">{todo.title}</span>
        </div>
        {todo.description && (
          <p className="text-sm mt-1.5 pl-10 line-clamp-2 invisible">{todo.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 pl-10 invisible">
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
      className="mb-2 rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md hover:border-border/80 transition-all select-none"
      onClick={onTitleClick}
    >
      {/* 제목 행 */}
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
        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${PRIORITY_DOT[todo.priority]}`} />
        <span
          className={`flex-1 min-w-0 text-sm leading-snug truncate ${todo.isDone ? 'line-through text-muted-foreground' : ''}`}
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
            <PanePickerSubmenu onPaneSelect={(paneId) => onOpenInPane?.(paneId)}>
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
              onDeleted={onDelete}
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
        <p className="text-sm text-muted-foreground mt-1.5 pl-10 line-clamp-2">
          {todo.description}
        </p>
      )}

      {/* 푸터: 마감일 + 연결 + sub-todo 토글 */}
      <div className="flex items-center gap-2 mt-2 pl-10">
        {todo.dueDate && (
          <span className="text-xs text-muted-foreground">{formatDueDate(todo.dueDate)}</span>
        )}
        <span
          className="ml-auto flex items-center gap-1"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <LinkedEntityPopoverButton
            entityType="todo"
            entityId={todo.id}
            workspaceId={workspaceId}
          />
        </span>
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
      </div>

      {/* 서브 할 일 목록 */}
      {isOpen && subTodos.length > 0 && (
        <div className="mt-2 pl-10 flex flex-col gap-1">
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
    <div className="rounded-lg border border-border bg-card p-3 shadow-xl cursor-grabbing select-none rotate-1 opacity-95 w-72">
      <div className="flex items-start gap-2 min-w-0">
        <Checkbox checked={todo.isDone} disabled className="mt-0.5 shrink-0" />
        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${PRIORITY_DOT[todo.priority]}`} />
        <span
          className={`flex-1 text-sm leading-snug truncate ${todo.isDone ? 'line-through text-muted-foreground' : ''}`}
        >
          {todo.title}
        </span>
      </div>
      {todo.description && (
        <p className="text-sm text-muted-foreground mt-1.5 pl-10 line-clamp-2">
          {todo.description}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2 pl-10">
        {todo.dueDate && (
          <span className="text-xs text-muted-foreground">{formatDueDate(todo.dueDate)}</span>
        )}
        {subTodos.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <ChevronRight className="w-3 h-3" />
            {doneCount}/{subTodos.length}
          </span>
        )}
      </div>
    </div>
  )
}
