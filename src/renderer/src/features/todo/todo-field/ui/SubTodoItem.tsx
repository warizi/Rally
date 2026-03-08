import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreHorizontal } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { TableCell } from '@shared/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@shared/ui/dropdown-menu'
import type { TodoItem } from '@entities/todo'
import { TodoCheckbox } from './TodoCheckbox'
import { EditSubTodoDialog } from './EditSubTodoDialog'
import { DeleteTodoDialog } from '@features/todo/delete-todo/ui/DeleteTodoDialog'

interface Props {
  sub: TodoItem
  workspaceId: string
}

export function SubTodoItem({ sub, workspaceId }: Props): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sub.id
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <tr
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`border-b border-border transition-colors hover:bg-muted/50 bg-background ${isDragging ? 'opacity-50' : ''}`}
      >
        <TableCell className="w-8 px-2 py-2">
          <span
            {...attributes}
            {...listeners}
            className="flex cursor-grab text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-4 w-4" />
          </span>
        </TableCell>
        <TableCell className="w-8 px-2 py-2">
          <TodoCheckbox todoId={sub.id} workspaceId={workspaceId} checked={sub.isDone} />
        </TableCell>
        <TableCell className="py-2 max-w-0 w-full">
          <span
            className={`block text-sm truncate ${sub.isDone ? 'line-through text-muted-foreground' : ''}`}
          >
            {sub.title}
          </span>
        </TableCell>
        <TableCell className="w-8 py-2">
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
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
        </TableCell>
      </tr>
      <EditSubTodoDialog
        todoId={sub.id}
        workspaceId={workspaceId}
        currentTitle={sub.title}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteTodoDialog
        todoId={sub.id}
        workspaceId={workspaceId}
        hasSubTodos={false}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
