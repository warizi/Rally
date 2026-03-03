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
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@shared/ui/table'
import { useReorderTodoList } from '@entities/todo'
import type { TodoItem } from '@entities/todo'
import { TodoListItem } from './TodoListItem'

interface Props {
  todos: TodoItem[]
  subTodoMap: Map<string, TodoItem[]>
  workspaceId: string
  filterActive: boolean
  onItemClick: (todoId: string) => void
  onOpenInPane?: (todoId: string, paneId: string) => void
  onItemDeleted?: (todoId: string) => void
}

function DragOverlayCard({ todo }: { todo: TodoItem }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background shadow-lg text-sm opacity-95">
      <span className="text-muted-foreground">⋮⋮</span>
      <span className={`truncate ${todo.isDone ? 'line-through text-muted-foreground' : ''}`}>
        {todo.title}
      </span>
    </div>
  )
}

export function TodoListView({
  todos,
  subTodoMap,
  workspaceId,
  filterActive,
  onItemClick,
  onOpenInPane,
  onItemDeleted
}: Props): React.JSX.Element {
  const reorderList = useReorderTodoList()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 0, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) : null

  function handleDragStart(event: DragStartEvent): void {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveId(null)
    if (filterActive) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = todos.findIndex((t) => t.id === active.id)
    const newIndex = todos.findIndex((t) => t.id === over.id)
    if (oldIndex === newIndex) return
    const reordered = arrayMove(todos, oldIndex, newIndex)
    reorderList.mutate({
      workspaceId,
      updates: reordered.map((t, i) => ({ id: t.id, order: i }))
    })
  }

  if (todos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {filterActive ? '필터 조건에 맞는 할 일이 없습니다' : '할 일이 없습니다'}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent h-8">
                <TableHead className="w-8 h-8" />
                <TableHead className="w-8 h-8" />
                <TableHead className="h-8">제목</TableHead>
                <TableHead className="w-4 text-center h-8 @[400px]:w-20">
                  <span className="hidden @[400px]:block">중요도</span>
                </TableHead>
                <TableHead className="hidden @[400px]:table-cell w-24 text-center h-8">
                  상태
                </TableHead>
                <TableHead className="hidden @[600px]:table-cell w-28 text-center h-8">
                  마감일
                </TableHead>
                <TableHead className="w-8 h-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {todos.map((todo) => (
                <TodoListItem
                  key={todo.id}
                  todo={todo}
                  subTodos={subTodoMap.get(todo.id) ?? []}
                  workspaceId={workspaceId}
                  filterActive={filterActive}
                  onTitleClick={() => onItemClick(todo.id)}
                  onOpenInPane={onOpenInPane ? (paneId) => onOpenInPane(todo.id, paneId) : undefined}
                  onDeleted={() => onItemDeleted?.(todo.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeTodo ? <DragOverlayCard todo={activeTodo} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
