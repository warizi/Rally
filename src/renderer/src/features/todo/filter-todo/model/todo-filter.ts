import type { TodoStatus, TodoPriority, TodoItem } from '@entities/todo'

export interface TodoFilter {
  status: TodoStatus | 'all'
  priority: TodoPriority | 'all'
  startDateFrom: Date | null
  startDateTo: Date | null
  dueDateFrom: Date | null
  dueDateTo: Date | null
}

export const DEFAULT_FILTER: TodoFilter = {
  status: 'all',
  priority: 'all',
  startDateFrom: null,
  startDateTo: null,
  dueDateFrom: null,
  dueDateTo: null
}

export function isFilterActive(filter: TodoFilter): boolean {
  return (
    filter.status !== 'all' ||
    filter.priority !== 'all' ||
    !!filter.startDateFrom ||
    !!filter.startDateTo ||
    !!filter.dueDateFrom ||
    !!filter.dueDateTo
  )
}

export function filterToParams(filter: TodoFilter, prefix: string): Record<string, string> {
  return {
    [`${prefix}Status`]: filter.status,
    [`${prefix}Priority`]: filter.priority,
    [`${prefix}StartDateFrom`]: filter.startDateFrom?.toISOString() ?? '',
    [`${prefix}StartDateTo`]: filter.startDateTo?.toISOString() ?? '',
    [`${prefix}DueDateFrom`]: filter.dueDateFrom?.toISOString() ?? '',
    [`${prefix}DueDateTo`]: filter.dueDateTo?.toISOString() ?? ''
  }
}

export function filterFromParams(
  params: Record<string, string> | undefined,
  prefix: string
): TodoFilter {
  if (!params) return DEFAULT_FILTER
  return {
    status: (params[`${prefix}Status`] as TodoFilter['status']) || DEFAULT_FILTER.status,
    priority: (params[`${prefix}Priority`] as TodoFilter['priority']) || DEFAULT_FILTER.priority,
    startDateFrom: params[`${prefix}StartDateFrom`]
      ? new Date(params[`${prefix}StartDateFrom`])
      : null,
    startDateTo: params[`${prefix}StartDateTo`]
      ? new Date(params[`${prefix}StartDateTo`])
      : null,
    dueDateFrom: params[`${prefix}DueDateFrom`] ? new Date(params[`${prefix}DueDateFrom`]) : null,
    dueDateTo: params[`${prefix}DueDateTo`] ? new Date(params[`${prefix}DueDateTo`]) : null
  }
}

export function applyFilter(todos: TodoItem[], filter: TodoFilter): TodoItem[] {
  let result = todos
  if (filter.status !== 'all') {
    result = result.filter((t) => t.status === filter.status)
  }
  if (filter.priority !== 'all') {
    result = result.filter((t) => t.priority === filter.priority)
  }
  if (filter.startDateFrom) {
    const from = filter.startDateFrom
    result = result.filter((t) => t.startDate && new Date(t.startDate) >= from)
  }
  if (filter.startDateTo) {
    const to = filter.startDateTo
    const toEnd = new Date(to)
    toEnd.setHours(23, 59, 59, 999)
    result = result.filter((t) => t.startDate && new Date(t.startDate) <= toEnd)
  }
  if (filter.dueDateFrom) {
    const from = filter.dueDateFrom
    result = result.filter((t) => t.dueDate && new Date(t.dueDate) >= from)
  }
  if (filter.dueDateTo) {
    const to = filter.dueDateTo
    // dueDateTo는 해당 날짜 끝까지 포함 (23:59:59)
    const toEnd = new Date(to)
    toEnd.setHours(23, 59, 59, 999)
    result = result.filter((t) => t.dueDate && new Date(t.dueDate) <= toEnd)
  }
  return result
}
