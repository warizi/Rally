import { MoreHorizontal, Dot, X } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Checkbox } from '@shared/ui/checkbox'
import { TruncateTooltip } from '@shared/ui/truncate-tooltip'
import { Badge } from '@shared/ui/badge'
import { Button } from '@shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'
import { Popover, PopoverTrigger, PopoverContent } from '@shared/ui/popover'
import { Calendar } from '@shared/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { useUpdateTodo, TODO_STATUS, TODO_PRIORITY } from '@entities/todo'
import type { TodoItem, TodoStatus } from '@entities/todo'
import { DeleteTodoDialog } from '@features/todo/delete-todo/ui/DeleteTodoDialog'
import { LinkedEntityPopoverButton, PanePickerSubmenu } from '@features/entity-link/manage-link'

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

interface RowProps {
  todo: TodoItem
  workspaceId: string
  onTitleClick: () => void
  onOpenInPane?: (paneId: string) => void
  onDeleted?: () => void
}

function HoldingOnRow({
  todo,
  workspaceId,
  onTitleClick,
  onOpenInPane,
  onDeleted
}: RowProps): React.JSX.Element {
  const updateTodo = useUpdateTodo()

  return (
    <TableRow className="hover:bg-muted/50 bg-background">
      {/* 체크박스 (완료 처리) */}
      <TableCell className="w-8 px-2 py-2">
        <Checkbox
          checked={false}
          onCheckedChange={() =>
            updateTodo.mutate({ workspaceId, todoId: todo.id, data: { isDone: true } })
          }
        />
      </TableCell>

      {/* 제목 */}
      <TableCell className="py-2 max-w-0 w-full whitespace-normal">
        <TruncateTooltip content={todo.title}>
          <button
            className="text-left text-sm truncate min-w-0 w-full text-muted-foreground"
            onClick={onTitleClick}
          >
            {todo.title}
          </button>
        </TruncateTooltip>
      </TableCell>

      {/* 중요도 */}
      <TableCell className="w-4 p-0 @[400px]:w-20 text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer">
              <Badge
                variant="outline"
                className={`hidden @[400px]:inline-flex border ${PRIORITY_CLASS[todo.priority]}`}
              >
                {PRIORITY_LABEL[todo.priority]}
              </Badge>
              <Dot
                className={`h-4 w-4 scale-200 ${PRIORITY_DOT[todo.priority]} @[400px]:hidden`}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {TODO_PRIORITY.map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() =>
                  updateTodo.mutate({ workspaceId, todoId: todo.id, data: { priority: p } })
                }
                className={todo.priority === p ? 'font-semibold' : ''}
              >
                <Dot className={`h-4 w-4 scale-200 ${PRIORITY_DOT[p]}`} />
                {PRIORITY_LABEL[p]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>

      {/* 상태 */}
      <TableCell className="hidden @[400px]:table-cell w-24 py-2 text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer">
              <Badge variant="outline">{todo.status}</Badge>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {TODO_STATUS.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() =>
                  updateTodo.mutate({
                    workspaceId,
                    todoId: todo.id,
                    data: { status: s as TodoStatus }
                  })
                }
                className={todo.status === s ? 'font-semibold' : ''}
              >
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>

      {/* 마감일 */}
      <TableCell className="hidden @[600px]:table-cell w-28 py-2 text-center">
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
              {todo.dueDate ? format(new Date(todo.dueDate), 'yyyy.MM.dd') : '—'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              locale={ko}
              selected={todo.dueDate ? new Date(todo.dueDate) : undefined}
              onSelect={(date) =>
                updateTodo.mutate({
                  workspaceId,
                  todoId: todo.id,
                  data: { dueDate: date ?? null }
                })
              }
            />
            {todo.dueDate && (
              <div className="border-t px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs w-full text-destructive hover:text-destructive"
                  onClick={() =>
                    updateTodo.mutate({
                      workspaceId,
                      todoId: todo.id,
                      data: { dueDate: null }
                    })
                  }
                >
                  <X className="size-3 mr-1" />
                  마감일 삭제
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </TableCell>

      {/* 연결 + 더보기 메뉴 */}
      <TableCell className="py-2">
        <div className="flex items-center justify-end gap-0.5">
        <LinkedEntityPopoverButton
          entityType="todo"
          entityId={todo.id}
          workspaceId={workspaceId}
        />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PanePickerSubmenu
              onPaneSelect={(paneId) => onOpenInPane?.(paneId)}
            >
              {({ onClick }) => (
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={onClick}>
                  상세 보기
                </DropdownMenuItem>
              )}
            </PanePickerSubmenu>
            <DeleteTodoDialog
              todoId={todo.id}
              workspaceId={workspaceId}
              hasSubTodos={false}
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
    </TableRow>
  )
}

interface Props {
  todos: TodoItem[]
  workspaceId: string
  filterActive: boolean
  onItemClick: (todoId: string) => void
  onOpenInPane?: (todoId: string, paneId: string) => void
  onItemDeleted?: (todoId: string) => void
}

export function TodoHoldingOnView({
  todos,
  workspaceId,
  filterActive,
  onItemClick,
  onOpenInPane,
  onItemDeleted
}: Props): React.JSX.Element {
  if (todos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {filterActive ? '필터 조건에 맞는 보류 항목이 없습니다' : '보류된 항목이 없습니다'}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent h-8">
            <TableHead className="w-8 h-8" />
            <TableHead className="h-8">제목</TableHead>
            <TableHead className="w-4 text-center h-8 @[400px]:w-20">
              <span className="hidden @[400px]:block">중요도</span>
            </TableHead>
            <TableHead className="hidden @[400px]:table-cell w-24 text-center h-8">상태</TableHead>
            <TableHead className="hidden @[600px]:table-cell w-28 text-center h-8">
              마감일
            </TableHead>
            <TableHead className="w-8 h-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {todos.map((todo) => (
            <HoldingOnRow
              key={todo.id}
              todo={todo}
              workspaceId={workspaceId}
              onTitleClick={() => onItemClick(todo.id)}
              onOpenInPane={onOpenInPane ? (paneId) => onOpenInPane(todo.id, paneId) : undefined}
              onDeleted={() => onItemDeleted?.(todo.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
