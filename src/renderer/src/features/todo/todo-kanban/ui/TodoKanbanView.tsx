import { useState, useEffect, useRef, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { useReorderTodoKanban } from '@entities/todo'
import type { TodoItem, TodoStatus } from '@entities/todo'
import { TodoKanbanBoard } from './TodoKanbanBoard'
import { TodoKanbanCardOverlay } from './TodoKanbanCard'
import { KANBAN_COLUMNS } from '../model/use-todo-kanban'

interface Props {
  todos: TodoItem[]
  subTodoMap: Map<string, TodoItem[]>
  columnMap: Map<TodoStatus, TodoItem[]>
  workspaceId: string
  filterActive: boolean
  activeColumn: number
  onColumnChange: (i: number) => void
  onItemClick: (todoId: string) => void
  onItemRightClick: (todoId: string) => void
  onItemDelete: (todoId: string) => void
}

export function TodoKanbanView({
  todos,
  subTodoMap,
  columnMap,
  workspaceId,
  filterActive,
  activeColumn,
  onColumnChange,
  onItemClick,
  onItemRightClick,
  onItemDelete
}: Props): React.JSX.Element {
  const reorderKanban = useReorderTodoKanban()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localColumns, setLocalColumns] = useState<Map<TodoStatus, TodoItem[]>>(columnMap)
  const [isCarouselMode, setIsCarouselMode] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const boardDragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setIsCarouselMode(entry.contentRect.width < 600)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 드래그 중이 아닐 때만 서버 데이터로 동기화
  useEffect(() => {
    if (!activeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalColumns(columnMap)
    }
  }, [columnMap, activeId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const activeTodo = useMemo(
    () => (activeId ? (todos.find((t) => t.id === activeId) ?? null) : null),
    [activeId, todos]
  )

  function handleDragStart(event: DragStartEvent): void {
    if (filterActive) return
    setActiveId(event.active.id as string)
    setLocalColumns(columnMap)
  }

  function handleDragOver(event: DragOverEvent): void {
    if (filterActive) return
    const { active, over } = event
    if (!over) return

    const draggedId = active.id as string
    const overId = over.id as string

    // 드래그 중인 아이템의 현재 컬럼 찾기
    let sourceStatus: TodoStatus | undefined
    for (const [status, items] of localColumns) {
      if (items.some((t) => t.id === draggedId)) {
        sourceStatus = status
        break
      }
    }
    if (!sourceStatus) return

    // 타겟 컬럼 찾기
    let targetStatus: TodoStatus | undefined
    if (KANBAN_COLUMNS.includes(overId as TodoStatus)) {
      targetStatus = overId as TodoStatus
    } else {
      for (const [status, items] of localColumns) {
        if (items.some((t) => t.id === overId)) {
          targetStatus = status
          break
        }
      }
    }
    if (!targetStatus) return

    // 같은 컬럼 내 재정렬은 SortableContext CSS transform 으로 처리
    if (sourceStatus === targetStatus) return

    // 컬럼 간 이동 — localColumns 실시간 업데이트 (미리보기)
    setLocalColumns((prev) => {
      const next = new Map<TodoStatus, TodoItem[]>()
      for (const [s, items] of prev) {
        next.set(s, [...items])
      }

      const sourceTodo = next.get(sourceStatus!)!.find((t) => t.id === draggedId)
      if (!sourceTodo) return prev

      // source 에서 제거
      next.set(
        sourceStatus!,
        next.get(sourceStatus!)!.filter((t) => t.id !== draggedId)
      )

      // target 에 삽입
      const targetItems = next.get(targetStatus!)!
      const movedTodo = { ...sourceTodo, status: targetStatus! }

      if (KANBAN_COLUMNS.includes(overId as TodoStatus)) {
        // 컬럼 빈 공간에 드롭 → 맨 끝에 추가
        targetItems.push(movedTodo)
      } else {
        const overIndex = targetItems.findIndex((t) => t.id === overId)
        targetItems.splice(Math.max(0, overIndex), 0, movedTodo)
      }

      return next
    })
  }

  function handleDragEnd(event: DragEndEvent): void {
    const prevActiveId = activeId
    setActiveId(null)

    if (filterActive || !prevActiveId) {
      setLocalColumns(columnMap)
      return
    }

    const { active, over } = event
    if (!over) {
      setLocalColumns(columnMap)
      return
    }

    const draggedId = active.id as string
    const overId = over.id as string

    const sourceTodo = todos.find((t) => t.id === draggedId)
    if (!sourceTodo) {
      setLocalColumns(columnMap)
      return
    }

    // localColumns 기준으로 최종 위치 확인
    let targetStatus: TodoStatus | undefined
    for (const [status, items] of localColumns) {
      if (items.some((t) => t.id === draggedId)) {
        targetStatus = status
        break
      }
    }
    if (!targetStatus) {
      setLocalColumns(columnMap)
      return
    }

    if (sourceTodo.status !== targetStatus) {
      // 컬럼 간 이동 — localColumns 기준으로 target 전체 order 업데이트
      const targetColumn = localColumns.get(targetStatus) ?? []
      reorderKanban.mutate({
        workspaceId,
        updates: targetColumn.map((t, i) => ({
          id: t.id,
          order: i,
          ...(t.id === draggedId ? { status: targetStatus } : {})
        }))
      })
    } else {
      // 같은 컬럼 내 재정렬
      if (KANBAN_COLUMNS.includes(overId as TodoStatus)) {
        // 빈 영역 드롭 — 변경 없음
        return
      }
      const column = columnMap.get(sourceTodo.status) ?? []
      const oldIndex = column.findIndex((t) => t.id === draggedId)
      const newIndex = column.findIndex((t) => t.id === overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      const reordered = arrayMove(column, oldIndex, newIndex)
      reorderKanban.mutate({
        workspaceId,
        updates: reordered.map((t, i) => ({ id: t.id, order: i }))
      })
    }
  }

  function handleDragCancel(): void {
    setActiveId(null)
    setLocalColumns(columnMap)
  }

  function handleBoardMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    if ((e.target as HTMLElement).closest('[data-kanban-card]')) return
    const el = boardScrollRef.current
    if (!el) return
    e.preventDefault()
    boardDragState.current = { isDown: true, startX: e.clientX, scrollLeft: el.scrollLeft }
  }

  function handleBoardMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (!boardDragState.current.isDown) return
    const el = boardScrollRef.current
    if (!el) return
    el.scrollLeft = boardDragState.current.scrollLeft - (e.clientX - boardDragState.current.startX)
  }

  function handleBoardStop(): void {
    boardDragState.current.isDown = false
  }

  return (
    <div ref={containerRef} className="h-full">
      <DndContext
        sensors={isCarouselMode ? [] : sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* 캐러셀: < @[600px] */}
        <div className="@[600px]:hidden h-full flex flex-col">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onColumnChange(Math.max(0, activeColumn - 1))}
              disabled={activeColumn === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex gap-1.5">
                {KANBAN_COLUMNS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => onColumnChange(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeColumn ? 'bg-foreground' : 'bg-muted-foreground/30'
                      }`}
                  />
                ))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onColumnChange(Math.min(KANBAN_COLUMNS.length - 1, activeColumn + 1))}
              disabled={activeColumn === KANBAN_COLUMNS.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <TodoKanbanBoard
              status={KANBAN_COLUMNS[activeColumn]}
              todos={localColumns.get(KANBAN_COLUMNS[activeColumn]) ?? []}
              subTodoMap={subTodoMap}
              workspaceId={workspaceId}
              onItemClick={onItemClick}
              onItemRightClick={onItemRightClick}
              onItemDelete={onItemDelete}
              className="w-full"
            />
          </div>
        </div>

        {/* 가로 스크롤: ≥ @[600px] */}
        <div
          ref={boardScrollRef}
          className="hidden @[600px]:flex h-full gap-3 overflow-x-auto pb-3 cursor-grab active:cursor-grabbing scrollbar-hide"
          onMouseDown={handleBoardMouseDown}
          onMouseMove={handleBoardMouseMove}
          onMouseUp={handleBoardStop}
          onMouseLeave={handleBoardStop}
        >
          {KANBAN_COLUMNS.map((status) => (
            <TodoKanbanBoard
              key={status}
              status={status}
              todos={localColumns.get(status) ?? []}
              subTodoMap={subTodoMap}
              workspaceId={workspaceId}
              onItemClick={onItemClick}
              onItemRightClick={onItemRightClick}
              onItemDelete={onItemDelete}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTodo ? (
            <TodoKanbanCardOverlay
              todo={activeTodo}
              subTodos={subTodoMap.get(activeTodo.id) ?? []}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
