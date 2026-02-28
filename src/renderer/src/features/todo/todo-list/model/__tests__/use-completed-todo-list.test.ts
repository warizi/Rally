import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { TodoItem } from '@entities/todo'
import { useCompletedTodoList } from '../use-completed-todo-list'
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
  dueDate: null,
  startDate: null
}

function makeTodoItem(overrides?: Partial<TodoItem>): TodoItem {
  return { ...BASE_TODO, ...overrides }
}

// filter는 파라미터 — 내부 state 없으므로 rerender 사용
describe('useCompletedTodoList', () => {
  it('parentId≠null 항목 방어 처리 — filteredCompleted에서 제외', () => {
    const todos = [
      makeTodoItem({ id: 'top', parentId: null, isDone: true }),
      makeTodoItem({ id: 'sub', parentId: 'top', isDone: true })
    ]
    const { result } = renderHook(() => useCompletedTodoList(todos, DEFAULT_FILTER))
    expect(result.current.filteredCompleted.map((t) => t.id)).toEqual(['top'])
  })

  it('doneAt DESC 정렬 — 최근 완료가 앞', () => {
    const todos = [
      makeTodoItem({ id: 'old', doneAt: new Date('2026-01-01'), isDone: true }),
      makeTodoItem({ id: 'new', doneAt: new Date('2026-01-31'), isDone: true })
    ]
    const { result } = renderHook(() => useCompletedTodoList(todos, DEFAULT_FILTER))
    expect(result.current.filteredCompleted[0].id).toBe('new')
    expect(result.current.filteredCompleted[1].id).toBe('old')
  })

  it('doneAt=null 항목 → 맨 뒤 (0으로 처리)', () => {
    const todos = [
      makeTodoItem({ id: 'with-date', doneAt: new Date('2026-01-15'), isDone: true }),
      makeTodoItem({ id: 'no-date', doneAt: null, isDone: true })
    ]
    const { result } = renderHook(() => useCompletedTodoList(todos, DEFAULT_FILTER))
    expect(result.current.filteredCompleted[1].id).toBe('no-date')
  })

  describe('filterActive — status 항상 all로 치환', () => {
    it('DEFAULT_FILTER → false', () => {
      const { result } = renderHook(() => useCompletedTodoList([], DEFAULT_FILTER))
      expect(result.current.filterActive).toBe(false)
    })
    it("status='완료'만 설정 → false (status가 'all'로 치환)", () => {
      const { result } = renderHook(() =>
        useCompletedTodoList([], { ...DEFAULT_FILTER, status: '완료' })
      )
      expect(result.current.filterActive).toBe(false)
    })
    it("priority='high' → true", () => {
      const { result } = renderHook(() =>
        useCompletedTodoList([], { ...DEFAULT_FILTER, priority: 'high' })
      )
      expect(result.current.filterActive).toBe(true)
    })
  })

  it('filter 변경 시 rerender로 재계산 확인', () => {
    const todos = [
      makeTodoItem({ id: 'high', priority: 'high', isDone: true }),
      makeTodoItem({ id: 'low', priority: 'low', isDone: true })
    ]
    const { result, rerender } = renderHook(
      ({ filter }) => useCompletedTodoList(todos, filter),
      { initialProps: { filter: DEFAULT_FILTER } }
    )
    expect(result.current.filteredCompleted).toHaveLength(2)
    rerender({ filter: { ...DEFAULT_FILTER, priority: 'high' } })
    expect(result.current.filteredCompleted).toHaveLength(1)
    expect(result.current.filteredCompleted[0].id).toBe('high')
  })
})
