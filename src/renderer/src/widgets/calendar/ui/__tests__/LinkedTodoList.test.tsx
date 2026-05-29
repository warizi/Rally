/**
 * widgets/calendar/ui/LinkedTodoList.test.tsx
 *
 * useLinkedTodos 결과 → 목록 렌더. unlink 버튼 → useUnlinkTodo.mutate.
 * compact=true + >3 → "+N개 더" 표시. 비었으면 "연결된 할 일이 없습니다".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

interface FakeTodo {
  id: string
  title: string
  isDone: boolean
}

const mocks = vi.hoisted(() => ({
  todos: [] as FakeTodo[],
  unlinkMutate: vi.fn()
}))

vi.mock('../../model/use-linked-todos', () => ({
  useLinkedTodos: () => ({ data: mocks.todos }),
  useUnlinkTodo: () => ({ mutate: mocks.unlinkMutate })
}))

vi.mock('../TodoLinkPopover', () => ({
  TodoLinkPopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="todo-link-popover">{children}</div>
  )
}))

import { LinkedTodoList } from '../LinkedTodoList'

beforeEach(() => {
  mocks.todos = []
  mocks.unlinkMutate.mockReset()
})

describe('LinkedTodoList', () => {
  it('빈 목록 → "연결된 할 일이 없습니다"', () => {
    render(<LinkedTodoList scheduleId="s1" workspaceId="ws" />)
    expect(screen.getByText('연결된 할 일이 없습니다')).toBeInTheDocument()
  })

  it('목록 있음 → 각 todo 제목 노출', () => {
    mocks.todos = [
      { id: 't1', title: 'Task A', isDone: false },
      { id: 't2', title: 'Task B', isDone: true }
    ]
    render(<LinkedTodoList scheduleId="s1" workspaceId="ws" />)
    expect(screen.getByText('Task A')).toBeInTheDocument()
    expect(screen.getByText('Task B')).toBeInTheDocument()
  })

  it('isDone=true → line-through 클래스', () => {
    mocks.todos = [{ id: 't1', title: '완료 태스크', isDone: true }]
    render(<LinkedTodoList scheduleId="s1" workspaceId="ws" />)
    expect(screen.getByText('완료 태스크').className).toMatch(/line-through/)
  })

  it('unlink 버튼 클릭 → unlinkMutate({scheduleId, todoId})', () => {
    mocks.todos = [{ id: 't1', title: 'A', isDone: false }]
    const { container } = render(<LinkedTodoList scheduleId="s1" workspaceId="ws" />)
    const unlinkBtn = container.querySelectorAll('button')[1]
    fireEvent.click(unlinkBtn!)
    expect(mocks.unlinkMutate).toHaveBeenCalledWith({ scheduleId: 's1', todoId: 't1' })
  })

  it('compact=true + >3 항목 → "+N개 더" 표시', () => {
    mocks.todos = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      isDone: false
    }))
    render(<LinkedTodoList scheduleId="s1" workspaceId="ws" compact />)
    expect(screen.getByText('Task 0')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
    expect(screen.queryByText('Task 3')).not.toBeInTheDocument()
    expect(screen.getByText('+2개 더')).toBeInTheDocument()
  })
})
