import { useState } from 'react'
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
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { GripVertical } from 'lucide-react'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@shared/ui/table'
import { useReorderTodoSub } from '@entities/todo'
import type { TodoItem } from '@entities/todo'
import { CreateTodoDialog } from '@features/todo/create-todo/ui/CreateTodoDialog'
import { SubTodoItem } from './SubTodoItem'

interface Props {
  subTodos: TodoItem[]
  workspaceId: string
  parentId: string
}

export function SubTodoListView({ subTodos, workspaceId, parentId }: Props): React.JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(null)
  const reorderSub = useReorderTodoSub()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 0, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const activeSub = activeId ? subTodos.find((t) => t.id === activeId) : null

  function handleDragStart(event: DragStartEvent): void {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = subTodos.findIndex((t) => t.id === active.id)
    const newIndex = subTodos.findIndex((t) => t.id === over.id)
    if (oldIndex === newIndex) return
    const reordered = arrayMove(subTodos, oldIndex, newIndex)
    reorderSub.mutate({
      workspaceId,
      parentId,
      updates: reordered.map((t, i) => ({ id: t.id, order: i }))
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="rounded-md border border-border overflow-hidden h-fit">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent h-8">
              <TableHead className="w-8 h-8" />
              <TableHead className="w-8 h-8" />
              <TableHead className="h-8">제목</TableHead>
              <TableHead className="w-8 h-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {subTodos.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="py-4 text-center">
                  <CreateTodoDialog
                    workspaceId={workspaceId}
                    parentId={parentId}
                    trigger={
                      <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        + 버튼을 눌러 하위 할 일을 추가하세요
                      </button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              <SortableContext
                items={subTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {subTodos.map((sub) => (
                  <SubTodoItem key={sub.id} sub={sub} workspaceId={workspaceId} />
                ))}
              </SortableContext>
            )}
          </TableBody>
        </Table>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeSub ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background shadow-lg text-sm opacity-95">
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
  )
}
