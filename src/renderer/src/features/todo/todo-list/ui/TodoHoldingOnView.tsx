import { MoreHorizontal, Dot } from 'lucide-react'
import { Checkbox } from '@shared/ui/checkbox'
import { Badge } from '@shared/ui/badge'
import { Button } from '@shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { useUpdateTodo } from '@entities/todo'
import type { TodoItem } from '@entities/todo'
import { DeleteTodoDialog } from '@features/todo/delete-todo/ui/DeleteTodoDialog'

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
  onRightPaneClick?: () => void
  onDeleted?: () => void
}

function HoldingOnRow({
  todo,
  workspaceId,
  onTitleClick,
  onRightPaneClick,
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
        <button
          className="text-left text-sm truncate min-w-0 w-full text-muted-foreground"
          onClick={onTitleClick}
        >
          {todo.title}
        </button>
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

      {/* 마감일 */}
      <TableCell className="hidden @[400px]:table-cell w-28 py-2 text-xs text-muted-foreground text-center">
        {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('ko-KR') : '—'}
      </TableCell>

      {/* 더보기 메뉴 */}
      <TableCell className="w-8 py-2">
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
      </TableCell>
    </TableRow>
  )
}

interface Props {
  todos: TodoItem[]
  workspaceId: string
  filterActive: boolean
  onItemClick: (todoId: string) => void
  onItemRightClick?: (todoId: string) => void
  onItemDeleted?: (todoId: string) => void
}

export function TodoHoldingOnView({
  todos,
  workspaceId,
  filterActive,
  onItemClick,
  onItemRightClick,
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
            <TableHead className="hidden @[400px]:table-cell w-28 text-center h-8">
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
              onRightPaneClick={onItemRightClick ? () => onItemRightClick(todo.id) : undefined}
              onDeleted={() => onItemDeleted?.(todo.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
