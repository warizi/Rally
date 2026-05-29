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
})
