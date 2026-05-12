/**
 * P1-4 진입 게이트: TodoListItem 렌더 baseline.
 *
 * 검증된 사실: TodoListItem.tsx 의 useCallback/useMemo/React.memo 사용 횟수 = 0건 (grep -c).
 *
 * 본 파일의 목적:
 *   1. 렌더 측정 인프라(render-counter) 가 TodoListItem 위에서 동작함을 입증
 *   2. P1-4 적용 후 자동으로 회귀 잡힐 spec(`it.fails`) 작성
 *   3. 핵심 행동(체크박스 → todo.update IPC) 회귀 안전망
 *
 * 풀 통합 baseline(100항목 + 부모 TodoList wrapper) 은 P1-4 작업 직전 추가.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { readFileSync } from 'fs'
import path from 'path'

import { TodoListItem } from '../TodoListItem'
import type { TodoItem } from '@entities/todo'
import { renderWithCounter } from '@/test/render-counter'
import { TestProviders } from '@/test/providers'
import { mockApi, defaultApiMock } from '@/test/ipc-mock'

const TODO_LIST_ITEM_PATH = path.resolve(__dirname, '../TodoListItem.tsx')

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

function ListWrapper({ todos }: { todos: TodoItem[] }): React.JSX.Element {
  return (
    <TestProviders>
      <DndContext>
        <SortableContext items={todos.map((t) => t.id)}>
          <table>
            <tbody>
              {todos.map((todo) => (
                <TodoListItem
                  key={todo.id}
                  todo={todo}
                  subTodos={[]}
                  workspaceId="ws1"
                  filterActive={false}
                  onTitleClick={(): void => {}}
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
})

describe('TodoListItem — render baseline', () => {
  // ──────────────────────────────────────────────
  // S1 — 측정 인프라 동작 확인 + baseline 기록
  // ──────────────────────────────────────────────
  it('[BASELINE] S1 — render-counter measures initial 5-item mount', () => {
    const todos = Array.from({ length: 5 }, (_, i) => makeTodo(`t${i}`))
    const { counter } = renderWithCounter(<ListWrapper todos={todos} />)

    // eslint-disable-next-line no-console
    console.log(`[BASELINE] Initial 5-item mount renders: ${counter.count}`)
    expect(counter.count).toBeGreaterThan(0)
  })

  // ──────────────────────────────────────────────
  // S2 — 새로운 todo 배열로 rerender (참조 변경) → 모든 항목 재렌더
  // 이게 P1-4 본질: 부모가 새 배열을 만들면 자식 모두 리렌더 → 100항목 시 N건
  // ──────────────────────────────────────────────
  it('[BASELINE] S2 — new-array rerender re-renders all children (no memo today)', () => {
    const todos = Array.from({ length: 5 }, (_, i) => makeTodo(`t${i}`))
    const { counter, result } = renderWithCounter(<ListWrapper todos={todos} />)
    counter.reset()

    // 부모가 새 배열 참조로 rerender (실제 상황: setState 등)
    const newTodos = todos.map((t) => ({ ...t }))
    result.rerender(<ListWrapper todos={newTodos} />)

    // eslint-disable-next-line no-console
    console.log(`[BASELINE] New-array rerender (5 items) renders: ${counter.count}`)
    expect(counter.count).toBeGreaterThan(0)
  })

  // ──────────────────────────────────────────────
  // S3 — 행동 회귀: 체크박스 클릭 → todo.update IPC 호출
  // P1-4 메모이제이션 후에도 동작 유지 검증
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
    // useUpdateTodo IPC 시그니처: window.api.todo.update(todoId, data)
    // (workspaceId 는 hook 인자에는 있지만 IPC 호출에는 미전달 — onSuccess 의 invalidation 키 용도)
    const call = (window.api.todo.update as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('t-target') // todoId
    expect(call[1]).toMatchObject({ isDone: true }) // data
  })

  // ──────────────────────────────────────────────
  // S4 — 메모이제이션 0건 fact 단순 검증 (현재 PASS, P1-4 후 자동 FAIL)
  // ──────────────────────────────────────────────
  it('[BASELINE] S4 — TodoListItem.tsx currently uses zero memoization (grep fact)', () => {
    const src = readFileSync(TODO_LIST_ITEM_PATH, 'utf-8')
    const hasMemoization = /useCallback|useMemo|React\.memo|\bmemo\(TodoListItem/.test(src)
    expect(hasMemoization).toBe(false)
  })

  // ──────────────────────────────────────────────
  // S5 — P1-4 후 통과 예정 spec (현재는 fail, it.fails 로 의도된 fail 표시)
  // React.memo 또는 useCallback 도입 시 expect 통과 → it.fails 가 fail → 회귀 감지
  // ──────────────────────────────────────────────
  it.fails('S5 — TodoListItem applies React.memo or useCallback (post P1-4 target)', () => {
    const src = readFileSync(TODO_LIST_ITEM_PATH, 'utf-8')
    expect(src).toMatch(/React\.memo|\bmemo\(TodoListItem|useCallback/)
  })
})
