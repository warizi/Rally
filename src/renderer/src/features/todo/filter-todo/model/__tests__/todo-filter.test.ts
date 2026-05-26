import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FILTER,
  isFilterActive,
  filterToParams,
  filterFromParams,
  applyFilter,
  type TodoFilter
} from '../todo-filter'
import type { TodoItem } from '@entities/todo'

function makeTodoItem(overrides?: Partial<TodoItem>): TodoItem {
  return {
    id: 't1',
    workspaceId: 'ws',
    parentId: null,
    title: 'Test',
    description: '',
    status: '할일',
    priority: 'medium',
    isDone: false,
    listOrder: 0,
    kanbanOrder: 0,
    subOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    doneAt: null,
    dueDate: null,
    startDate: null,
    createdBy: 'user',
    createdById: null,
    updatedBy: 'user',
    updatedById: null,
    ...overrides
  }
}

describe('isFilterActive', () => {
  it('DEFAULT_FILTER → false', () => expect(isFilterActive(DEFAULT_FILTER)).toBe(false))
  it("status='할일' → true", () =>
    expect(isFilterActive({ ...DEFAULT_FILTER, status: '할일' })).toBe(true))
  it("priority='high' → true", () =>
    expect(isFilterActive({ ...DEFAULT_FILTER, priority: 'high' })).toBe(true))
  it('dueDateFrom 설정 → true', () =>
    expect(isFilterActive({ ...DEFAULT_FILTER, dueDateFrom: new Date() })).toBe(true))
  it('dueDateTo 설정 → true', () =>
    expect(isFilterActive({ ...DEFAULT_FILTER, dueDateTo: new Date() })).toBe(true))
})

describe('filterFromParams', () => {
  it('undefined → DEFAULT_FILTER', () => {
    expect(filterFromParams(undefined, 'k')).toEqual(DEFAULT_FILTER)
  })
  it('빈 객체 {} → DEFAULT_FILTER', () => {
    expect(filterFromParams({}, 'k')).toEqual(DEFAULT_FILTER)
  })
  it("kStatus='' → status='all' (빈 문자열 fallback)", () => {
    expect(filterFromParams({ kStatus: '' }, 'k').status).toBe('all')
  })
})

describe('roundtrip filterToParams → filterFromParams', () => {
  it('날짜 없는 필터 roundtrip', () => {
    const filter: TodoFilter = {
      status: '할일',
      priority: 'high',
      startDateFrom: null,
      startDateTo: null,
      dueDateFrom: null,
      dueDateTo: null
    }
    expect(filterFromParams(filterToParams(filter, 'k'), 'k')).toEqual(filter)
  })
  it('날짜 포함 필터 roundtrip', () => {
    const filter: TodoFilter = {
      status: 'all',
      priority: 'all',
      startDateFrom: null,
      startDateTo: null,
      dueDateFrom: new Date('2026-01-01'),
      dueDateTo: new Date('2026-01-31')
    }
    expect(filterFromParams(filterToParams(filter, 'k'), 'k')).toEqual(filter)
  })
  it('null 날짜 roundtrip → null 복원', () => {
    const filter = { ...DEFAULT_FILTER }
    const params = filterToParams(filter, 'k')
    expect(params.kDueDateFrom).toBe('')
    expect(filterFromParams(params, 'k').dueDateFrom).toBeNull()
  })
})

describe('applyFilter', () => {
  it('DEFAULT_FILTER → 전체 반환', () => {
    const todos = [makeTodoItem(), makeTodoItem({ id: 't2', status: '완료' })]
    expect(applyFilter(todos, DEFAULT_FILTER)).toHaveLength(2)
  })

  it("status='할일' → 해당 status만", () => {
    const todos = [makeTodoItem({ status: '할일' }), makeTodoItem({ id: 't2', status: '완료' })]
    const result = applyFilter(todos, { ...DEFAULT_FILTER, status: '할일' })
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('할일')
  })

  it("priority='high' → 해당 priority만", () => {
    const todos = [makeTodoItem({ priority: 'high' }), makeTodoItem({ id: 't2', priority: 'low' })]
    expect(applyFilter(todos, { ...DEFAULT_FILTER, priority: 'high' })).toHaveLength(1)
  })

  it('dueDateFrom 설정 + dueDate 있음 → 포함', () => {
    const from = new Date('2026-01-10')
    const todo = makeTodoItem({ dueDate: new Date('2026-01-15') })
    expect(applyFilter([todo], { ...DEFAULT_FILTER, dueDateFrom: from })).toHaveLength(1)
  })

  it('dueDateFrom 설정 + dueDate=null → 제외', () => {
    const from = new Date('2026-01-10')
    const todo = makeTodoItem({ dueDate: null })
    expect(applyFilter([todo], { ...DEFAULT_FILTER, dueDateFrom: from })).toHaveLength(0)
  })

  it('dueDateTo 설정 → end-of-day 23:59:59.999 포함', () => {
    const to = new Date('2026-01-31')
    const todo = makeTodoItem({ dueDate: new Date('2026-01-31T23:59:00') })
    expect(applyFilter([todo], { ...DEFAULT_FILTER, dueDateTo: to })).toHaveLength(1)
  })

  it('dueDateTo 설정 + dueDate=null → 제외', () => {
    const to = new Date('2026-01-31')
    const todo = makeTodoItem({ dueDate: null })
    expect(applyFilter([todo], { ...DEFAULT_FILTER, dueDateTo: to })).toHaveLength(0)
  })

  it('status + priority 복합 필터 (AND 적용)', () => {
    const todos = [
      makeTodoItem({ status: '할일', priority: 'high' }),
      makeTodoItem({ id: 't2', status: '할일', priority: 'low' }),
      makeTodoItem({ id: 't3', status: '완료', priority: 'high' })
    ]
    const result = applyFilter(todos, { ...DEFAULT_FILTER, status: '할일', priority: 'high' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('t1')
  })
})
