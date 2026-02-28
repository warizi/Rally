import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTodoList } from '../use-todo-list'
import { DEFAULT_FILTER } from '../../../filter-todo/model/todo-filter'
import type { TodoItem } from '@entities/todo'

const BASE_TODO: TodoItem = {
  id: 'todo-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Test',
  description: '',
  status: '할일',
  priority: 'medium',
  isDone: false,
  listOrder: 0,
  kanbanOrder: 0,
  subOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  doneAt: null,
  dueDate: null,
  startDate: null
}

function makeTodoItem(overrides?: Partial<TodoItem>): TodoItem {
  return { ...BASE_TODO, ...overrides }
}

describe('useTodoList', () => {
  it('빈 allTodos → filteredTopLevel=[], subTodoMap.size=0, filterActive=false', () => {
    const { result } = renderHook(() => useTodoList([], DEFAULT_FILTER))
    expect(result.current.filteredTopLevel).toEqual([])
    expect(result.current.subTodoMap.size).toBe(0)
    expect(result.current.filterActive).toBe(false)
  })

  it('topLevel — parentId=null 항목만 포함', () => {
    const todos = [
      makeTodoItem({ id: 'p1', parentId: null }),
      makeTodoItem({ id: 'c1', parentId: 'p1' })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    expect(result.current.filteredTopLevel.map((t) => t.id)).toEqual(['p1'])
  })

  it('subTodoMap — subOrder ASC 정렬', () => {
    const todos = [
      makeTodoItem({ id: 'p1' }),
      makeTodoItem({ id: 'c2', parentId: 'p1', subOrder: 2 }),
      makeTodoItem({ id: 'c1', parentId: 'p1', subOrder: 1 })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    const children = result.current.subTodoMap.get('p1')!
    expect(children.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('subTodoMap — 필터 적용 후에도 서브투두 포함 (비필터 동작)', () => {
    const todos = [
      makeTodoItem({ id: 'p-low', priority: 'low' }),
      makeTodoItem({ id: 'c1', parentId: 'p-low', priority: 'low' })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    act(() => {
      result.current.setFilter({ ...DEFAULT_FILTER, priority: 'high' })
    })
    expect(result.current.filteredTopLevel).toHaveLength(0)
    expect(result.current.subTodoMap.get('p-low')).toHaveLength(1)
  })

  it('filteredTopLevel — listOrder ASC 정렬', () => {
    const todos = [
      makeTodoItem({ id: 't2', listOrder: 2 }),
      makeTodoItem({ id: 't0', listOrder: 0 }),
      makeTodoItem({ id: 't1', listOrder: 1 })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    expect(result.current.filteredTopLevel.map((t) => t.id)).toEqual(['t0', 't1', 't2'])
  })

  describe('filterActive', () => {
    it('DEFAULT_FILTER → false', () => {
      const { result } = renderHook(() => useTodoList([]))
      expect(result.current.filterActive).toBe(false)
    })
    it("status='할일' → true (useTodoKanban과 다름)", () => {
      const { result } = renderHook(() => useTodoList([], { ...DEFAULT_FILTER, status: '할일' }))
      expect(result.current.filterActive).toBe(true)
    })
    it("priority='high' → true", () => {
      const { result } = renderHook(() =>
        useTodoList([], { ...DEFAULT_FILTER, priority: 'high' })
      )
      expect(result.current.filterActive).toBe(true)
    })
  })

  it('setFilter 호출 → filteredTopLevel 재계산', () => {
    const todos = [
      makeTodoItem({ id: 't-high', priority: 'high' }),
      makeTodoItem({ id: 't-low', priority: 'low' })
    ]
    const { result } = renderHook(() => useTodoList(todos))
    expect(result.current.filteredTopLevel).toHaveLength(2)
    act(() => {
      result.current.setFilter({ ...DEFAULT_FILTER, priority: 'high' })
    })
    expect(result.current.filteredTopLevel).toHaveLength(1)
    expect(result.current.filteredTopLevel[0].id).toBe('t-high')
  })
})
