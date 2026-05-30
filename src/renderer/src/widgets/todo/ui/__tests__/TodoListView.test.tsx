/**
 * widgets/todo/ui/TodoListView.test.tsx
 *
 * empty / filterActive empty / todos 렌더. DnD context wrap.
 * TodoListItem 자체는 mock (이 컴포넌트의 책임 외).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  reorderMutate: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useReorderTodoList: () => ({ mutate: mocks.reorderMutate })
}))
vi.mock('../TodoListItem', () => ({
  TodoListItem: ({ todo }: { todo: { id: string; title: string } }) => (
    <tr data-testid="todo-item">
      <td>{todo.title}</td>
    </tr>
  )
}))

import { TodoListView } from '../TodoListView'
import type { TodoItem } from '@entities/todo'

function todo(id: string, title = `Todo ${id}`): TodoItem {
  return { id, title, isDone: false } as unknown as TodoItem
}

beforeEach(() => {
  mocks.reorderMutate.mockClear()
})

describe('TodoListView', () => {
  it('empty + filterActive=false → "할 일이 없습니다"', () => {
    render(
      <TodoListView
        todos={[]}
        subTodoMap={new Map()}
        workspaceId="ws-1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('할 일이 없습니다')).toBeInTheDocument()
  })

  it('empty + filterActive=true → 필터 메시지', () => {
    render(
      <TodoListView
        todos={[]}
        subTodoMap={new Map()}
        workspaceId="ws-1"
        filterActive={true}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('필터 조건에 맞는 할 일이 없습니다')).toBeInTheDocument()
  })

  it('todos N개 → TodoListItem N개 렌더', () => {
    render(
      <TodoListView
        todos={[todo('t1'), todo('t2'), todo('t3')]}
        subTodoMap={new Map()}
        workspaceId="ws-1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getAllByTestId('todo-item')).toHaveLength(3)
    expect(screen.getByText('Todo t1')).toBeInTheDocument()
  })

  it('Table 헤더 노출 (제목, 중요도, 상태, 마감일)', () => {
    render(
      <TodoListView
        todos={[todo('t1')]}
        subTodoMap={new Map()}
        workspaceId="ws-1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('제목')).toBeInTheDocument()
    expect(screen.getByText('중요도')).toBeInTheDocument()
    expect(screen.getByText('상태')).toBeInTheDocument()
    expect(screen.getByText('마감일')).toBeInTheDocument()
  })

  it('subTodoMap → 자식 todo 도 렌더', () => {
    const subMap = new Map<string, TodoItem[]>()
    subMap.set('t1', [todo('s1', 'Sub Task 1'), todo('s2', 'Sub Task 2')])
    render(
      <TodoListView
        todos={[todo('t1')]}
        subTodoMap={subMap}
        workspaceId="ws-1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    // TodoListItem mock 이 자식까지 보여주진 않지만 렌더 에러 없음.
    expect(screen.getByText('Todo t1')).toBeInTheDocument()
  })

  it('onItemDeleted prop → 전달 (smoke)', () => {
    const onItemDeleted = vi.fn()
    render(
      <TodoListView
        todos={[todo('t1')]}
        subTodoMap={new Map()}
        workspaceId="ws-1"
        filterActive={false}
        onItemClick={vi.fn()}
        onItemDeleted={onItemDeleted}
      />
    )
    expect(screen.getByText('Todo t1')).toBeInTheDocument()
  })

  it('onOpenInPane prop → 전달 (smoke)', () => {
    const onOpenInPane = vi.fn()
    render(
      <TodoListView
        todos={[todo('t1')]}
        subTodoMap={new Map()}
        workspaceId="ws-1"
        filterActive={false}
        onItemClick={vi.fn()}
        onOpenInPane={onOpenInPane}
      />
    )
    expect(screen.getByText('Todo t1')).toBeInTheDocument()
  })

  it('Table 헤더는 todos.length>0 일 때만 노출 (empty 일 땐 미노출)', () => {
    render(
      <TodoListView
        todos={[]}
        subTodoMap={new Map()}
        workspaceId="ws-1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.queryByText('제목')).toBeNull()
    expect(screen.queryByText('중요도')).toBeNull()
  })

  it('todos 1개 + subTodoMap 다른 키 → 자식 매핑 안 됨', () => {
    const subMap = new Map<string, TodoItem[]>()
    subMap.set('other-parent', [todo('s1', 'Sub Sub')])
    render(
      <TodoListView
        todos={[todo('t1')]}
        subTodoMap={subMap}
        workspaceId="ws-1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    // 부모 td만 노출, 자식 없음
    expect(screen.getByText('Todo t1')).toBeInTheDocument()
    expect(screen.queryByText('Sub Sub')).toBeNull()
  })

  it('큰 데이터셋 (todos 50개) → 모두 렌더', () => {
    const big = Array.from({ length: 50 }, (_, i) => todo(`t-${i}`))
    render(
      <TodoListView
        todos={big}
        subTodoMap={new Map()}
        workspaceId="ws-1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getAllByTestId('todo-item')).toHaveLength(50)
  })
})
