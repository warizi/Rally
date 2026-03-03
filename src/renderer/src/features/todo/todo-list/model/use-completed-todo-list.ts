import { useMemo } from 'react'
import type { TodoItem } from '@entities/todo'
import { applyFilter, isFilterActive, type TodoFilter } from '../../filter-todo/model/todo-filter'

export function useCompletedTodoList(
  completedTodos: TodoItem[],
  filter: TodoFilter
): {
  filteredCompleted: TodoItem[]
  filterActive: boolean
} {
  const filteredCompleted = useMemo(() => {
    // completed 쿼리 결과는 이미 parentId=null만 포함하지만 방어적 처리
    const topLevel = completedTodos.filter((t) => t.parentId === null)
    // status 필터는 모두 '완료'이므로 'all'로 고정
    const result = applyFilter(topLevel, { ...filter, status: 'all' })
    // doneAt DESC 정렬 (가장 최근 완료된 항목 위)
    return [...result].sort((a, b) => {
      const aTime = a.doneAt ? new Date(a.doneAt).getTime() : 0
      const bTime = b.doneAt ? new Date(b.doneAt).getTime() : 0
      return bTime - aTime
    })
  }, [completedTodos, filter])

  const filterActive = useMemo(() => isFilterActive({ ...filter, status: 'all' }), [filter])

  return { filteredCompleted, filterActive }
}
