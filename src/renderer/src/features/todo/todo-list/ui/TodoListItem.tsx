import { useState } from 'react'
import { toast } from 'sonner'
import { arrayMove } from '@dnd-kit/sortable'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreHorizontal, ChevronDown, ChevronRight, Dot } from 'lucide-react'
import { Checkbox } from '@shared/ui/checkbox'
import { Badge } from '@shared/ui/badge'
import { Button } from '@shared/ui/button'
import { TableCell } from '@shared/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { useUpdateTodo, useReorderTodoSub } from '@entities/todo'
import type { TodoItem } from '@entities/todo'
import { DeleteTodoDialog } from '@features/todo/delete-todo/ui/DeleteTodoDialog'
import { EditSubTodoDialog } from '@features/todo/todo-field/ui/EditSubTodoDialog'
import { LinkedEntityPopoverButton } from '@features/entity-link/manage-link'

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  medium:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  low: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
}
const PRIORITY_DOT: Record<string, string> = {
  high: 'text-rose-400',
  medium: 'text-amber-400',
  low: 'text-sky-400'
}
const PRIORITY_LABEL: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' }

// 하위 할 일 행 (colSpan 내부 — div 렌더링)
interface SubItemProps {
  todo: TodoItem
  workspaceId: string
}

function SubTodoItem({ todo, workspaceId }: SubItemProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: todo.id })
  const updateTodo = useUpdateTodo()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className="flex items-center gap-2 py-1.5 px-2"
      >
        <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground shrink-0">
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <Checkbox
          checked={todo.isDone}
          onCheckedChange={(checked) =>
            updateTodo.mutate(
              { workspaceId, todoId: todo.id, data: { isDone: !!checked } },
              {
                onSuccess: () => {
                  if (checked) toast.success(`"${todo.title}" 완료!`)
                }
              }
            )
          }
        />
        <span
          className={`flex-1 text-sm ${todo.isDone ? 'line-through text-muted-foreground' : ''}`}
        >
          {todo.title}
        </span>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false)
                setEditOpen(true)
              }}
            >
              수정
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                setMenuOpen(false)
                setDeleteOpen(true)
              }}
            >
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <EditSubTodoDialog
        todoId={todo.id}
        workspaceId={workspaceId}
        currentTitle={todo.title}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteTodoDialog
        todoId={todo.id}
        workspaceId={workspaceId}
        hasSubTodos={false}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

interface Props {
  todo: TodoItem
  subTodos: TodoItem[]
  workspaceId: string
  filterActive: boolean
  onTitleClick: () => void
  onRightPaneClick?: () => void
  onDeleted?: () => void
}

export function TodoListItem({
  todo,
  subTodos,
  workspaceId,
  filterActive,
  onTitleClick,
  onRightPaneClick,
  onDeleted
}: Props): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id
  })
  const [isOpen, setIsOpen] = useState(false)
  const [activeSubId, setActiveSubId] = useState<string | null>(null)
  const updateTodo = useUpdateTodo()
  const reorderSub = useReorderTodoSub()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 0, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const activeSub = activeSubId ? subTodos.find((t) => t.id === activeSubId) : null

  function handleSubDragStart(event: DragStartEvent): void {
    setActiveSubId(event.active.id as string)
  }

  function handleSubDragEnd(event: DragEndEvent): void {
    setActiveSubId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = subTodos.findIndex((t) => t.id === active.id)
    const newIndex = subTodos.findIndex((t) => t.id === over.id)
    if (oldIndex === newIndex) return
    const reordered = arrayMove(subTodos, oldIndex, newIndex)
    reorderSub.mutate({
      workspaceId,
      parentId: todo.id,
      updates: reordered.map((t, i) => ({ id: t.id, order: i }))
    })
  }

  return (
    <>
      {/* 메인 행 */}
      <tr
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`border-b border-border transition-colors hover:bg-muted/50 bg-background ${isDragging ? 'opacity-50' : ''}`}
      >
        {/* 드래그 핸들 */}
        <TableCell className="w-8 px-2 py-2">
          <span
            {...(!filterActive ? attributes : {})}
            {...(!filterActive ? listeners : {})}
            className={`flex text-muted-foreground ${filterActive ? 'opacity-30 cursor-not-allowed' : 'cursor-grab hover:text-foreground'}`}
          >
            <GripVertical className="h-4 w-4" />
          </span>
        </TableCell>
        <TableCell className="w-8 px-2 py-2">
          <Checkbox
            checked={todo.isDone}
            onCheckedChange={(checked) =>
              updateTodo.mutate(
                { workspaceId, todoId: todo.id, data: { isDone: !!checked } },
                {
                  onSuccess: () => {
                    if (checked) toast.success(`"${todo.title}" 완료!`)
                  }
                }
              )
            }
          />
        </TableCell>

        {/* 제목 (접기 토글 포함) */}
        <TableCell className="py-2 max-w-0 w-full whitespace-normal">
          <div className="flex items-center gap-2 overflow-hidden">
            {subTodos.length > 0 && (
              <button
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen((o) => !o)}
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <button
              className={`text-left text-sm truncate min-w-0 flex-1 ${todo.isDone ? 'line-through text-muted-foreground' : ''}`}
              onClick={onTitleClick}
            >
              {todo.title}
            </button>
          </div>
        </TableCell>

        {/* 중요도 */}
        <TableCell className="w-4 p-0 @[400px]:w-20 text-center">
          <Badge
            variant="outline"
            className={`hidden @[400px]:inline-flex border ${PRIORITY_CLASS[todo.priority]}`}
          >
            {PRIORITY_LABEL[todo.priority]}
          </Badge>
          <Dot className={`h-4 w-4 scale-200 ${PRIORITY_DOT[todo.priority]} @[400px]:hidden`} />
        </TableCell>

        {/* 상태 — @[400px]+ */}
        <TableCell className="hidden @[400px]:table-cell w-24 py-2">
          <Badge variant="outline">{todo.status}</Badge>
        </TableCell>

        {/* 마감일 — @[600px]+ */}
        <TableCell className="hidden @[600px]:table-cell w-28 py-2 text-xs text-muted-foreground text-center">
          {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('ko-KR') : '—'}
        </TableCell>

        {/* 연결 + 더보기 메뉴 */}
        <TableCell className="py-2">
          <div className="flex items-center justify-end gap-0.5">
            <LinkedEntityPopoverButton
              entityType="todo"
              entityId={todo.id}
              workspaceId={workspaceId}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>상세 보기</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={onTitleClick}>현재 탭 열기</DropdownMenuItem>
                    <DropdownMenuItem onClick={onRightPaneClick}>오른쪽 탭 열기</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DeleteTodoDialog
                  todoId={todo.id}
                  workspaceId={workspaceId}
                  hasSubTodos={subTodos.length > 0}
                  onDeleted={onDeleted}
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
        </TableCell>
      </tr>

      {/* 하위 할 일 확장 행 */}
      {isOpen && subTodos.length > 0 && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={7} className="p-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragStart={handleSubDragStart}
              onDragEnd={handleSubDragEnd}
            >
              <SortableContext
                items={subTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="pl-10 py-1 divide-y divide-border/50">
                  {subTodos.map((sub) => (
                    <SubTodoItem key={sub.id} todo={sub} workspaceId={workspaceId} />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeSub ? (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-background shadow-lg text-sm opacity-95">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span
                      className={`truncate ${activeSub.isDone ? 'line-through text-muted-foreground' : ''}`}
                    >
                      {activeSub.title}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </td>
        </tr>
      )}
    </>
  )
}
