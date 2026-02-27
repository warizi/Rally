import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { TodoItem } from '@entities/todo'
import { useTodoKanban } from '../use-todo-kanban'
import { DEFAULT_FILTER } from '../../../filter-todo/model/todo-filter'

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
  dueDate: null
}

function makeTodoItem(overrides?: Partial<TodoItem>): TodoItem {
  return { ...BASE_TODO, ...overrides }
}

describe('useTodoKanban', () => {
  it('빈 allTodos → 4개 컬럼 모두 [] (undefined 아님)', () => {
    const { result } = renderHook(() => useTodoKanban([]))
    expect(result.current.columnMap.get('할일')).toEqual([])
    expect(result.current.columnMap.get('진행중')).toEqual([])
    expect(result.current.columnMap.get('완료')).toEqual([])
    expect(result.current.columnMap.get('보류')).toEqual([])
    expect(result.current.subTodoMap.size).toBe(0)
  })

  it('columnMap — 4개 키 항상 존재', () => {
    const { result } = renderHook(() => useTodoKanban([]))
    expect(result.current.columnMap.size).toBe(4)
  })

  it('columnMap — status별 kanbanOrder ASC 정렬', () => {
    const todos = [
      makeTodoItem({ id: 't2', status: '할일', kanbanOrder: 2 }),
      makeTodoItem({ id: 't1', status: '할일', kanbanOrder: 1 })
    ]
    const { result } = renderHook(() => useTodoKanban(todos))
    expect(result.current.columnMap.get('할일')!.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('subTodoMap — kanbanOrder ASC 정렬 (subOrder 아님)', () => {
    const todos = [
      makeTodoItem({ id: 'p1' }),
      makeTodoItem({ id: 'c2', parentId: 'p1', kanbanOrder: 2, subOrder: 1 }),
      makeTodoItem({ id: 'c1', parentId: 'p1', kanbanOrder: 1, subOrder: 2 })
    ]
    const { result } = renderHook(() => useTodoKanban(todos))
    expect(result.current.subTodoMap.get('p1')!.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('subTodoMap — 필터에서 제외된 부모의 서브투두도 포함', () => {
    const todos = [
      makeTodoItem({ id: 'p-low', status: '할일', priority: 'low' }),
      makeTodoItem({ id: 'c1', parentId: 'p-low' })
    ]
    const { result } = renderHook(() =>
      useTodoKanban(todos, 0, { ...DEFAULT_FILTER, priority: 'high' })
    )
    expect(result.current.columnMap.get('할일')).toHaveLength(0)
    expect(result.current.subTodoMap.get('p-low')).toHaveLength(1)
  })

  describe('filterActive — status 제외', () => {
    it('DEFAULT_FILTER → false', () => {
      const { result } = renderHook(() => useTodoKanban([]))
      expect(result.current.filterActive).toBe(false)
    })
    it("status='할일'만 → false (useTodoList와 다름)", () => {
      const { result } = renderHook(() =>
        useTodoKanban([], 0, { ...DEFAULT_FILTER, status: '할일' })
      )
      expect(result.current.filterActive).toBe(false)
    })
    it("priority='high' → true", () => {
      const { result } = renderHook(() =>
        useTodoKanban([], 0, { ...DEFAULT_FILTER, priority: 'high' })
      )
      expect(result.current.filterActive).toBe(true)
    })
    it('dueDateFrom 설정 → true', () => {
      const { result } = renderHook(() =>
        useTodoKanban([], 0, { ...DEFAULT_FILTER, dueDateFrom: new Date() })
      )
      expect(result.current.filterActive).toBe(true)
    })
  })

  it('setActiveColumn → activeColumn 변경', () => {
    const { result } = renderHook(() => useTodoKanban([]))
    act(() => {
      result.current.setActiveColumn(2)
    })
    expect(result.current.activeColumn).toBe(2)
  })

  it('dueDate=null 투두는 날짜 필터에서 제외', () => {
    const todos = [makeTodoItem({ id: 'no-due', dueDate: null, status: '할일' })]
    const { result } = renderHook(() =>
      useTodoKanban(todos, 0, { ...DEFAULT_FILTER, dueDateFrom: new Date('2026-01-01') })
    )
    expect(result.current.columnMap.get('할일')).toHaveLength(0)
  })
})
