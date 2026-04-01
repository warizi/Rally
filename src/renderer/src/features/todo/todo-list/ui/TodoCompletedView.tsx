import { MoreHorizontal, Dot } from 'lucide-react'
import { Checkbox } from '@shared/ui/checkbox'
import { TruncateTooltip } from '@shared/ui/truncate-tooltip'
import { Badge } from '@shared/ui/badge'
import { Button } from '@shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import { useUpdateTodo } from '@entities/todo'
import type { TodoItem } from '@entities/todo'
import type { CompletedItem, RecurringCompletionItem } from '@entities/recurring-completion'
import { useUncompleteRecurring } from '@entities/recurring-completion'
import { DeleteTodoDialog } from '@features/todo/delete-todo/ui/DeleteTodoDialog'
import { PanePickerSubmenu } from '@features/entity-link/manage-link'

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  medium:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-rose-800',
  low: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
}
const PRIORITY_DOT: Record<string, string> = {
  high: 'text-rose-400',
  medium: 'text-amber-400',
  low: 'text-sky-400'
}
const PRIORITY_LABEL: Record<string, string> = { high: '높음', medium: '보통', low: '낮음' }

// 일반 todo 완료 행
interface TodoRowProps {
  todo: TodoItem
  workspaceId: string
  onTitleClick: () => void
  onOpenInPane?: (paneId: string) => void
  onDeleted?: () => void
}

function TodoCompletedRow({
  todo,
  workspaceId,
  onTitleClick,
  onOpenInPane,
  onDeleted
}: TodoRowProps): React.JSX.Element {
  const updateTodo = useUpdateTodo()

  return (
    <TableRow className="hover:bg-muted/50 bg-background">
      <TableCell className="w-8 px-2 py-2">
        <Checkbox
          checked={true}
          onCheckedChange={() =>
            updateTodo.mutate({ workspaceId, todoId: todo.id, data: { isDone: false } })
          }
        />
      </TableCell>
      <TableCell className="py-2 max-w-0 w-full whitespace-normal">
        <TruncateTooltip content={todo.title}>
          <button
            className="text-left text-sm truncate min-w-0 w-full line-through text-muted-foreground"
            onClick={onTitleClick}
          >
            {todo.title}
          </button>
        </TruncateTooltip>
      </TableCell>
      <TableCell className="w-4 p-0 @[400px]:w-20 text-center">
        <Badge
          variant="outline"
          className={`hidden @[400px]:inline-flex border ${PRIORITY_CLASS[todo.priority]}`}
        >
          {PRIORITY_LABEL[todo.priority]}
        </Badge>
        <Dot className={`h-4 w-4 scale-200 ${PRIORITY_DOT[todo.priority]} @[400px]:hidden`} />
      </TableCell>
      <TableCell className="hidden @[400px]:table-cell w-28 py-2 text-xs text-muted-foreground text-center">
        {todo.doneAt ? new Date(todo.doneAt).toLocaleDateString('ko-KR') : '—'}
      </TableCell>
      <TableCell className="w-8 py-2">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <PanePickerSubmenu onPaneSelect={(paneId) => onOpenInPane?.(paneId)}>
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
      </TableCell>
    </TableRow>
  )
}

// 반복 완료 행
interface RecurringRowProps {
  completion: RecurringCompletionItem
  workspaceId: string
}

function RecurringCompletedRow({ completion, workspaceId }: RecurringRowProps): React.JSX.Element {
  const uncomplete = useUncompleteRecurring()

  return (
    <TableRow className="hover:bg-muted/50 bg-background">
      <TableCell className="w-8 px-2 py-2">
        <Checkbox
          checked={true}
          onCheckedChange={() =>
            uncomplete.mutate({
              workspaceId,
              completionId: completion.id,
              date: completion.completedAt
            })
          }
        />
      </TableCell>
      <TableCell className="py-2 max-w-0 w-full whitespace-normal">
        <TruncateTooltip content={completion.ruleTitle}>
          <span className="text-left text-sm truncate min-w-0 w-full block line-through text-muted-foreground">
            {completion.ruleTitle}
          </span>
        </TruncateTooltip>
      </TableCell>
      {/* 반복 완료는 중요도 없음 */}
      <TableCell className="w-4 p-0 @[400px]:w-20 text-center">
        <Badge variant="outline" className="hidden @[400px]:inline-flex text-muted-foreground">
          반복
        </Badge>
      </TableCell>
      <TableCell className="hidden @[400px]:table-cell w-28 py-2 text-xs text-muted-foreground text-center">
        {completion.completedAt.toLocaleDateString('ko-KR')}
      </TableCell>
      {/* 반복 완료는 상세 없음 */}
      <TableCell className="w-8 py-2" />
    </TableRow>
  )
}

interface Props {
  items: CompletedItem[]
  workspaceId: string
  filterActive: boolean
  onItemClick: (todoId: string) => void
  onOpenInPane?: (todoId: string, paneId: string) => void
  onItemDeleted?: (todoId: string) => void
}

export function TodoCompletedView({
  items,
  workspaceId,
  filterActive,
  onItemClick,
  onOpenInPane,
  onItemDeleted
}: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {filterActive ? '필터 조건에 맞는 완료 항목이 없습니다' : '완료된 항목이 없습니다'}
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
              완료일
            </TableHead>
            <TableHead className="w-8 h-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            if (item.type === 'todo') {
              const todo = item.todo
              return (
                <TodoCompletedRow
                  key={`todo-${todo.id}`}
                  todo={todo}
                  workspaceId={workspaceId}
                  onTitleClick={() => onItemClick(todo.id)}
                  onOpenInPane={
                    onOpenInPane ? (paneId) => onOpenInPane(todo.id, paneId) : undefined
                  }
                  onDeleted={() => onItemDeleted?.(todo.id)}
                />
              )
            }
            const rc = item.recurringCompletion!
            return (
              <RecurringCompletedRow
                key={`recurring-${rc.id}`}
                completion={rc}
                workspaceId={workspaceId}
              />
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
