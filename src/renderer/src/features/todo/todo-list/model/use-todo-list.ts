import { useState, useMemo } from 'react'
import type { TodoItem } from '@entities/todo'
import {
  applyFilter,
  DEFAULT_FILTER,
  isFilterActive,
  TodoFilter
} from '../../filter-todo/model/todo-filter'

export function useTodoList(
  allTodos: TodoItem[],
  initialFilter: TodoFilter = DEFAULT_FILTER
): {
  filter: TodoFilter
  setFilter: (filter: TodoFilter) => void
  filteredTopLevel: TodoItem[]
  subTodoMap: Map<string, TodoItem[]>
  filterActive: boolean
} {
  const [filter, setFilter] = useState<TodoFilter>(initialFilter)

  const topLevel = useMemo(
    () => allTodos.filter((t) => t.parentId === null && t.status !== '보류'),
    [allTodos]
  )

  const subTodoMap = useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    for (const t of allTodos) {
      if (t.parentId) {
        const arr = map.get(t.parentId) ?? []
        arr.push(t)
        map.set(t.parentId, arr)
      }
    }
    for (const [, items] of map) {
      items.sort((a, b) => a.subOrder - b.subOrder)
    }
    return map
  }, [allTodos])

  const filteredTopLevel = useMemo(() => {
    const result = applyFilter(topLevel, filter)
    return [...result].sort((a, b) => a.listOrder - b.listOrder)
  }, [topLevel, filter])

  const filterActive = useMemo(() => isFilterActive(filter), [filter])

  return {
    filter,
    setFilter,
    filteredTopLevel,
    subTodoMap,
    filterActive
  }
}
