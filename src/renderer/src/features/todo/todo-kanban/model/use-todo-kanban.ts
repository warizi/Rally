import { useState, useMemo } from 'react'
import type { TodoItem, TodoStatus } from '@entities/todo'
import { DEFAULT_FILTER, TodoFilter } from '../../filter-todo/model/todo-filter'

export const KANBAN_COLUMNS: TodoStatus[] = ['할일', '진행중', '완료', '보류']

export function useTodoKanban(
  allTodos: TodoItem[],
  initialActiveColumn = 0,
  initialFilter: TodoFilter = DEFAULT_FILTER
): {
  filter: TodoFilter
  setFilter: (filter: TodoFilter) => void
  activeColumn: number
  setActiveColumn: (index: number) => void
  columnMap: Map<TodoStatus, TodoItem[]>
  subTodoMap: Map<string, TodoItem[]>
  filterActive: boolean
} {
  const [filter, setFilter] = useState<TodoFilter>(initialFilter)
  const [activeColumn, setActiveColumn] = useState(initialActiveColumn)

  const topLevel = useMemo(() => allTodos.filter((t) => t.parentId === null), [allTodos])

  const subTodoMap = useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    for (const t of allTodos) {
      if (t.parentId) {
        const arr = map.get(t.parentId) ?? []
        arr.push(t)
        map.set(t.parentId, arr)
      }
    }
    // kanbanOrder ASC 정렬
    for (const [, items] of map) {
      items.sort((a, b) => a.kanbanOrder - b.kanbanOrder)
    }
    return map
  }, [allTodos])

  // 칸반에서 status 필터는 보드 자체가 status별 분류이므로 불필요
  // priority, dueDate 필터 적용
  const columnMap = useMemo(() => {
    const map = new Map<TodoStatus, TodoItem[]>()
    const dueDateFrom = filter.dueDateFrom
    const dueDateTo = filter.dueDateTo ? new Date(filter.dueDateTo) : null
    if (dueDateTo) dueDateTo.setHours(23, 59, 59, 999)

    for (const col of KANBAN_COLUMNS) {
      const items = topLevel
        .filter((t) => t.status === col)
        .filter((t) => filter.priority === 'all' || t.priority === filter.priority)
        .filter((t) => !dueDateFrom || (t.dueDate && new Date(t.dueDate) >= dueDateFrom))
        .filter((t) => !dueDateTo || (t.dueDate && new Date(t.dueDate) <= dueDateTo))
        .sort((a, b) => a.kanbanOrder - b.kanbanOrder)
      map.set(col, items)
    }
    return map
  }, [topLevel, filter])

  // filterActive: kanban에서는 priority/dueDate 필터만 DnD 비활성화 기준
  // (status 필터는 TodoFilterBar에서 kanban 시 숨김 처리로 선택 불가)
  const filterActive = useMemo(
    () => filter.priority !== 'all' || !!filter.dueDateFrom || !!filter.dueDateTo,
    [filter]
  )

  return {
    filter,
    setFilter,
    activeColumn,
    setActiveColumn,
    columnMap,
    subTodoMap,
    filterActive
  }
}
