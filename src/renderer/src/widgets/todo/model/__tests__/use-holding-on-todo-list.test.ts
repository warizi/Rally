/**
 * useHoldingOnTodoList 회귀 테스트 (Todo 갭 분석 P0).
 *
 * - status === '보류' 인 최상위 할일만 필터링
 * - 보류 할일의 하위 subtodo 만 subTodoMap 빌드 (subOrder ASC)
 * - filter.status 는 'all' 로 강제 (보류만 보는 뷰는 다른 상태 필터 제외)
 * - filterActive 계산 (status 제외)
 * - listOrder ASC 정렬
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHoldingOnTodoList } from '../use-holding-on-todo-list'
import { DEFAULT_FILTER, type TodoItem } from '@entities/todo'

function makeTodo(overrides?: Partial<TodoItem>): TodoItem {
  return {
    id: 't1',
    workspaceId: 'ws-1',
    parentId: null,
    title: 'T',
    description: '',
    status: '보류',
    priority: 'medium',
    isDone: false,
    listOrder: 0,
    kanbanOrder: 0,
    subOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
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

describe('useHoldingOnTodoList', () => {
  it('빈 배열 → 모든 결과 비어있음, filterActive=false', () => {
    const { result } = renderHook(() => useHoldingOnTodoList([], DEFAULT_FILTER))
    expect(result.current.filteredHoldingOn).toEqual([])
    expect(result.current.subTodoMap.size).toBe(0)
    expect(result.current.filterActive).toBe(false)
  })

  it("status === '보류' 인 최상위 할일만 filteredHoldingOn 에 포함", () => {
    const todos = [
      makeTodo({ id: 'h1', status: '보류' }),
      makeTodo({ id: 'a1', status: '할일' }),
      makeTodo({ id: 'c1', status: '완료' })
    ]
    const { result } = renderHook(() => useHoldingOnTodoList(todos, DEFAULT_FILTER))
    expect(result.current.filteredHoldingOn.map((t) => t.id)).toEqual(['h1'])
  })

  it('보류 할일의 sub 만 subTodoMap 에 포함 (다른 status 의 sub 는 제외)', () => {
    const todos = [
      makeTodo({ id: 'hold', status: '보류' }),
      makeTodo({ id: 'active', status: '할일' }),
      makeTodo({ id: 'sub-of-hold', parentId: 'hold', status: '진행중' }),
      makeTodo({ id: 'sub-of-active', parentId: 'active', status: '진행중' })
    ]
    const { result } = renderHook(() => useHoldingOnTodoList(todos, DEFAULT_FILTER))
    expect(result.current.subTodoMap.get('hold')?.map((t) => t.id)).toEqual(['sub-of-hold'])
    expect(result.current.subTodoMap.has('active')).toBe(false)
  })

  it('subTodoMap → 같은 parent 의 sub 들이 subOrder ASC 정렬', () => {
    const todos = [
      makeTodo({ id: 'hold', status: '보류' }),
      makeTodo({ id: 's2', parentId: 'hold', subOrder: 2 }),
      makeTodo({ id: 's0', parentId: 'hold', subOrder: 0 }),
      makeTodo({ id: 's1', parentId: 'hold', subOrder: 1 })
    ]
    const { result } = renderHook(() => useHoldingOnTodoList(todos, DEFAULT_FILTER))
    expect(result.current.subTodoMap.get('hold')?.map((t) => t.id)).toEqual(['s0', 's1', 's2'])
  })

  it('filteredHoldingOn → listOrder ASC 정렬', () => {
    const todos = [
      makeTodo({ id: 'h2', status: '보류', listOrder: 2 }),
      makeTodo({ id: 'h0', status: '보류', listOrder: 0 }),
      makeTodo({ id: 'h1', status: '보류', listOrder: 1 })
    ]
    const { result } = renderHook(() => useHoldingOnTodoList(todos, DEFAULT_FILTER))
    expect(result.current.filteredHoldingOn.map((t) => t.id)).toEqual(['h0', 'h1', 'h2'])
  })

  it("filter.status='할일' 이어도 보류만 반환 (보류 뷰에서 강제 'all' 적용)", () => {
    const todos = [makeTodo({ id: 'hold', status: '보류' })]
    const filter = { ...DEFAULT_FILTER, status: '할일' as const }
    const { result } = renderHook(() => useHoldingOnTodoList(todos, filter))
    expect(result.current.filteredHoldingOn).toHaveLength(1)
  })

  it("filterActive — status 만 다르면 false (status 강제 'all' 이므로)", () => {
    const filter = { ...DEFAULT_FILTER, status: '완료' as const }
    const { result } = renderHook(() => useHoldingOnTodoList([], filter))
    expect(result.current.filterActive).toBe(false)
  })

  it('filterActive — priority 변경 시 true', () => {
    const filter = { ...DEFAULT_FILTER, priority: 'high' as const }
    const { result } = renderHook(() => useHoldingOnTodoList([], filter))
    expect(result.current.filterActive).toBe(true)
  })

  it('priority 필터 → filteredHoldingOn 에 적용 (status 외 다른 필터는 적용됨)', () => {
    const todos = [
      makeTodo({ id: 'h1', status: '보류', priority: 'high' }),
      makeTodo({ id: 'h2', status: '보류', priority: 'low' })
    ]
    const filter = { ...DEFAULT_FILTER, priority: 'high' as const }
    const { result } = renderHook(() => useHoldingOnTodoList(todos, filter))
    expect(result.current.filteredHoldingOn.map((t) => t.id)).toEqual(['h1'])
  })
})
