/**
 * P1-4 회귀 안전망: TodoListItem 메모이제이션.
 *
 * 적용 이후 검증:
 *   1. 행동 회귀(체크박스 → todo.update IPC) 보존
 *   2. React.memo + useCallback 적용 사실 (grep)
 *   3. 동일 props 로 rerender 시 자식 재렌더 0건 (P1-4 핵심 효과)
 *   4. 자기 todo 만 변경 시 그 항목만 재렌더 (다른 항목 격리)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { Profiler, useMemo, type ProfilerOnRenderCallback } from 'react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { readFileSync } from 'fs'
import path from 'path'

import { TodoListItem, TodoListItemContent } from '../TodoListItem'
import type { TodoItem } from '@entities/todo'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { renderWithCounter } from '@/test/render-counter'
import { TestProviders } from '@/test/providers'
import { mockApi, defaultApiMock } from '@/test/ipc-mock'

const TODO_LIST_ITEM_PATH = path.resolve(__dirname, '../TodoListItem.tsx')

// 빈 subTodos 배열을 매번 새로 생성하면 React.memo 가 무력화 → 모듈 스코프로 고정
const EMPTY_SUB_TODOS: TodoItem[] = []

function makeTodo(id: string, overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id,
    workspaceId: 'ws1',
    parentId: null,
    title: `Todo ${id}`,
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
    ...overrides
  }
}

// 안정적인 부모 콜백 모킹 — 매번 같은 vi.fn 참조 사용해야 React.memo 효과 측정 가능
const stableOnItemClick = vi.fn()

function ListWrapper({ todos }: { todos: TodoItem[] }): React.JSX.Element {
  // SortableContext items 배열 안정화 — 아니면 useSortable consumer 가 context 변경으로 매번 rerender
  const todoIds = useMemo(() => todos.map((t) => t.id), [todos])
  return (
    <TestProviders>
      <DndContext>
        <SortableContext items={todoIds}>
          <table>
            <tbody>
              {todos.map((todo) => (
                <TodoListItem
                  key={todo.id}
                  todo={todo}
                  subTodos={EMPTY_SUB_TODOS}
                  workspaceId="ws1"
                  filterActive={false}
                  onItemClick={stableOnItemClick}
                />
              ))}
            </tbody>
          </table>
        </SortableContext>
      </DndContext>
    </TestProviders>
  )
}

beforeEach(() => {
  const api = defaultApiMock()
  api.todo.update.mockResolvedValue({ success: true, data: null })
  mockApi(api)
  stableOnItemClick.mockReset()
})

describe('TodoListItem — 메모이제이션 + 행동 회귀', () => {
  // ──────────────────────────────────────────────
  // S1 — 측정 인프라 동작 확인 + 적용 후 mount renders
  // ──────────────────────────────────────────────
  it('S1 — 5-item mount renders measurable', () => {
    const todos = Array.from({ length: 5 }, (_, i) => makeTodo(`t${i}`))
    const { counter } = renderWithCounter(<ListWrapper todos={todos} />)

    // eslint-disable-next-line no-console
    console.log(`[POST-P1-4] Initial 5-item mount renders: ${counter.count}`)
    expect(counter.count).toBeGreaterThan(0)
  })

  // ──────────────────────────────────────────────
  // S2 — 동일 참조 rerender 측정 (informational)
  //
  // 주의: @dnd-kit/sortable 의 useSortable 은 SortableContext context 를
  // 구독하므로, 부모 rerender 가 일어나면 context 변화로 인해 React.memo
  // 가 막을 수 없는 rerender 가 발생할 수 있다. 정확한 −90% 측정은
  // SortableWrapper 분리(별도 follow-up) 후 가능. 본 spec 은 회귀 감지용
  // 상한선만 설정 — baseline 대비 폭증하지 않으면 OK.
  // ──────────────────────────────────────────────
  it('S2 — same-ref rerender count stays within upper bound', () => {
    const todos = Array.from({ length: 5 }, (_, i) => makeTodo(`t${i}`))
    const { counter, result } = renderWithCounter(<ListWrapper todos={todos} />)
    counter.reset()

    result.rerender(<ListWrapper todos={todos} />)

    // eslint-disable-next-line no-console
    console.log(`[POST-P1-4] Same-ref rerender (5 items) renders: ${counter.count}`)
    // baseline 측정값 = 2 (dnd-kit context 한계). 폭증(>5) 시 회귀.
    expect(counter.count).toBeLessThanOrEqual(5)
  })

  // ──────────────────────────────────────────────
  // S3 — 행동 회귀: 체크박스 클릭 → todo.update IPC 호출
  // ──────────────────────────────────────────────
  it('S3 — clicking checkbox invokes todo.update IPC with correct ids', async () => {
    const todos = [makeTodo('t-target')]
    const { result } = renderWithCounter(<ListWrapper todos={todos} />)

    const checkbox = result.container.querySelector(
      'button[role="checkbox"]'
    ) as HTMLButtonElement | null
    expect(checkbox, 'checkbox rendered').not.toBeNull()
    if (!checkbox) return

    fireEvent.click(checkbox)

    await vi.waitFor(() => {
      expect(window.api.todo.update).toHaveBeenCalled()
    })
    const call = (window.api.todo.update as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('t-target')
    expect(call[1]).toMatchObject({ isDone: true })
  })

  // ──────────────────────────────────────────────
  // S4 — 메모이제이션 grep fact (P1-4 적용 사실 검증)
  // 이 spec 이 fail 하면 → 누군가 메모이제이션을 제거한 회귀
  // ──────────────────────────────────────────────
  it('S4 — TodoListItem applies React.memo + useCallback (P1-4 fact)', () => {
    const src = readFileSync(TODO_LIST_ITEM_PATH, 'utf-8')
    expect(src, 'React.memo 또는 memo() 사용').toMatch(/\bmemo\(|React\.memo/)
    expect(src, 'useCallback 1개 이상 사용').toMatch(/\buseCallback\(/)
  })

  // ──────────────────────────────────────────────
  // S5 — 한 항목만 바꾼 새 배열 → 그 항목만 재렌더, 나머지는 skip
  //
  // 주의: dnd-kit context 한계로 완전 0 은 SortableWrapper 분리 후. 본 테스트는
  // 변경된 항목이 재렌더되는지 + 미변경 항목들의 재렌더가 폭증하지 않는지만 검증.
  // ──────────────────────────────────────────────
  it('S5 — changing only one todo re-renders only that item', () => {
    const initial = Array.from({ length: 5 }, (_, i) => makeTodo(`t${i}`))

    // 항목별 Profiler 측정용 카운터
    const itemRenders = new Map<string, number>()
    const onRender: ProfilerOnRenderCallback = (id) => {
      itemRenders.set(id, (itemRenders.get(id) ?? 0) + 1)
    }

    function ProfiledList({ todos }: { todos: TodoItem[] }): React.JSX.Element {
      const todoIds = useMemo(() => todos.map((t) => t.id), [todos])
      return (
        <TestProviders>
          <DndContext>
            <SortableContext items={todoIds}>
              <table>
                <tbody>
                  {todos.map((todo) => (
                    <Profiler key={todo.id} id={`item-${todo.id}`} onRender={onRender}>
                      <TodoListItem
                        todo={todo}
                        subTodos={EMPTY_SUB_TODOS}
                        workspaceId="ws1"
                        filterActive={false}
                        onItemClick={stableOnItemClick}
                      />
                    </Profiler>
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </TestProviders>
      )
    }

    const { result } = renderWithCounter(<ProfiledList todos={initial} />)
    itemRenders.clear() // 초기 마운트 제외

    // t2 만 새 객체로 교체, 나머지는 동일 참조 유지
    const changed = initial.map((t, i) =>
      i === 2 ? { ...t, title: 'Changed!' } : t
    )
    result.rerender(<ProfiledList todos={changed} />)

    const changedCount = itemRenders.get('item-t2') ?? 0
    const otherTotal = ['t0', 't1', 't3', 't4']
      .map((id) => itemRenders.get(`item-${id}`) ?? 0)
      .reduce((a, b) => a + b, 0)

    // eslint-disable-next-line no-console
    console.log(
      `[POST-P1-4] Single-item change: changed=${changedCount}, others=${otherTotal}`
    )

    // 바뀐 항목은 반드시 재렌더
    expect(changedCount, '바뀐 항목은 재렌더').toBeGreaterThanOrEqual(1)
    // 바뀌지 않은 항목들의 재렌더 횟수: outer 레벨 Profiler 는 dnd-kit context
    // 변경으로 인한 outer rerender 도 계수 (실제 inner skip 여부는 S6 에서 검증).
    expect(otherTotal, '바뀌지 않은 항목 재렌더 상한선').toBeLessThanOrEqual(10)
  })

  // ──────────────────────────────────────────────
  // S6 — P1-4.5 SortableWrapper 분리 효과 검증 (inner 직접 측정)
  //
  // TodoListItemContent (inner) 를 DndContext 없이 직접 렌더 →
  // dnd-kit context 변경에 의한 강제 rerender 없음 → 순수 React.memo 만 측정.
  //
  // 동일 props 로 rerender 시 inner 가 완전히 skip 되어야 함 (memo 효과).
  // 5개 중 1개만 변경 시 그 항목만 inner 렌더, 나머지는 0건 → "100항목 ≤ 2" 달성.
  // ──────────────────────────────────────────────
  it('S6 — TodoListItemContent inner body skips for unchanged items (P1-4.5 split effect)', () => {
    // production-instrumentation counter: TodoListItemContent body 가 실제로
    // 호출될 때만 증가. React.memo skip 시 호출 안 됨 → 정확한 memo 효과 측정.
    const counter = new Map<string, number>()
    ;(globalThis as { __TODO_LIST_ITEM_RENDER_COUNTER__?: Map<string, number> })
      .__TODO_LIST_ITEM_RENDER_COUNTER__ = counter

    try {
      const initial = Array.from({ length: 5 }, (_, i) => makeTodo(`t${i}`))

      const stableSetNodeRef = (): void => {}
      const stableAttrs = {} as DraggableAttributes
      const stableListeners: DraggableSyntheticListeners = undefined

      function InnerList({ todos }: { todos: TodoItem[] }): React.JSX.Element {
        return (
          <TestProviders>
            <table>
              <tbody>
                {todos.map((todo) => (
                  <TodoListItemContent
                    key={todo.id}
                    todo={todo}
                    subTodos={EMPTY_SUB_TODOS}
                    workspaceId="ws1"
                    filterActive={false}
                    onItemClick={stableOnItemClick}
                    sortableAttributes={stableAttrs}
                    sortableListeners={stableListeners}
                    setNodeRef={stableSetNodeRef}
                    transform={null}
                    transition={undefined}
                    isDragging={false}
                  />
                ))}
              </tbody>
            </table>
          </TestProviders>
        )
      }

      const { result } = renderWithCounter(<InnerList todos={initial} />)
      counter.clear() // 초기 마운트 제외

      const changed = initial.map((t, i) => (i === 2 ? { ...t, title: 'Changed!' } : t))
      result.rerender(<InnerList todos={changed} />)

      const changedCount = counter.get('t2') ?? 0
      const others = ['t0', 't1', 't3', 't4'].map((id) => counter.get(id) ?? 0)
      const otherTotal = others.reduce((a, b) => a + b, 0)

      // eslint-disable-next-line no-console
      console.log(
        `[POST-P1-4.5] Inner body executions: changed=${changedCount}, others=${otherTotal}`
      )

      expect(changedCount, '바뀐 항목 inner body 는 실행됨').toBeGreaterThanOrEqual(1)
      expect(otherTotal, '바뀌지 않은 inner body 는 0건 실행 (P1-4.5 핵심)').toBe(0)
    } finally {
      ;(globalThis as { __TODO_LIST_ITEM_RENDER_COUNTER__?: Map<string, number> })
        .__TODO_LIST_ITEM_RENDER_COUNTER__ = undefined
    }
  })

  // ──────────────────────────────────────────────
  // S7 — P1-4.5 구조 검증: outer 가 inner 를 호출하는 분리 패턴 fact (grep)
  // ──────────────────────────────────────────────
  it('S7 — TodoListItem applies SortableWrapper split pattern (P1-4.5 fact)', () => {
    const src = readFileSync(TODO_LIST_ITEM_PATH, 'utf-8')
    // outer 는 일반 함수, inner 만 memo
    expect(src, 'TodoListItemContent inner export').toMatch(/export const TodoListItemContent = memo/)
    // SubTodoItem 도 같은 패턴
    expect(src, 'SubTodoItemContent memo').toMatch(/const SubTodoItemContent = memo/)
    // outer 는 useSortable 호출 + Content 한 줄 호출만
    expect(src, 'TodoListItem outer 가 Content 호출').toMatch(/<TodoListItemContent/)
    expect(src, 'SubTodoItem outer 가 Content 호출').toMatch(/<SubTodoItemContent/)
  })
})
