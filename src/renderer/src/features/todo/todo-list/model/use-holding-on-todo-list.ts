import { useMemo } from 'react'
import type { TodoItem } from '@entities/todo'
import { applyFilter, isFilterActive, type TodoFilter } from '../../filter-todo/model/todo-filter'

export function useHoldingOnTodoList(
  activeTodos: TodoItem[],
  filter: TodoFilter
): {
  filteredHoldingOn: TodoItem[]
  subTodoMap: Map<string, TodoItem[]>
  filterActive: boolean
} {
  const topLevel = useMemo(
    () => activeTodos.filter((t) => t.parentId === null && t.status === '보류'),
    [activeTodos]
  )

  const holdingOnIds = useMemo(() => new Set(topLevel.map((t) => t.id)), [topLevel])

  const subTodoMap = useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    for (const t of activeTodos) {
      if (t.parentId && holdingOnIds.has(t.parentId)) {
        const arr = map.get(t.parentId) ?? []
        arr.push(t)
        map.set(t.parentId, arr)
      }
    }
    for (const [, items] of map) {
      items.sort((a, b) => a.subOrder - b.subOrder)
    }
    return map
  }, [activeTodos, holdingOnIds])

  const filteredHoldingOn = useMemo(() => {
    const result = applyFilter(topLevel, { ...filter, status: 'all' })
    return [...result].sort((a, b) => a.listOrder - b.listOrder)
  }, [topLevel, filter])

  const filterActive = useMemo(
    () => isFilterActive({ ...filter, status: 'all' }),
    [filter]
  )

  return { filteredHoldingOn, subTodoMap, filterActive }
}
