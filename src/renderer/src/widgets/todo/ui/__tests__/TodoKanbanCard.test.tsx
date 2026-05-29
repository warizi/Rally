/**
 * widgets/todo/ui/TodoKanbanCard.test.tsx
 *
 * TodoKanbanCard: title/체크박스/priority strip + 더블클릭 → onItemClick.
 * TodoKanbanCardOverlay: pure 렌더 — subTodos 카운트 + dueDate.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false
  })
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } }
}))

vi.mock('@entities/todo', () => ({
  useUpdateTodo: () => ({ mutate: vi.fn() }),
  TODO_STATUS: ['할일', '진행중', '완료', '보류']
}))

vi.mock('@features/todo/delete-todo/ui/DeleteTodoDialog', () => ({
  DeleteTodoDialog: () => null
}))

vi.mock('@/widgets/entity-link', () => ({
  LinkedEntityPopoverButton: () => null,
  PanePickerSubmenu: ({
    children
  }: {
    children: (p: { onClick: () => void; isOpen: boolean }) => React.ReactNode
  }) => <>{children({ onClick: () => {}, isOpen: false })}</>
}))

vi.mock('@shared/ui/author-badge', () => ({
  AuthorBadge: () => null
}))

import { TodoKanbanCard, TodoKanbanCardOverlay } from '../TodoKanbanCard'

const baseTodo = {
  id: 't1',
  title: 'My Task',
  description: '',
  status: '할일',
  priority: 'high',
  isDone: false,
  dueDate: null
} as unknown as Parameters<typeof TodoKanbanCard>[0]['todo']

describe('TodoKanbanCard', () => {
  it('todo.title 노출', () => {
    render(
      <TodoKanbanCard
        todo={baseTodo}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(screen.getByText('My Task')).toBeInTheDocument()
  })

  it('isDone=true → line-through 클래스', () => {
    const done = { ...baseTodo, isDone: true } as unknown as Parameters<
      typeof TodoKanbanCard
    >[0]['todo']
    const { container } = render(
      <TodoKanbanCard
        todo={done}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(container.innerHTML).toMatch(/line-through/)
  })

  it('subTodos 있음 + 일부 done → "completed/total" 카운트 노출', () => {
    render(
      <TodoKanbanCard
        todo={baseTodo}
        subTodos={
          [
            { id: 's1', isDone: true },
            { id: 's2', isDone: true },
            { id: 's3', isDone: false }
          ] as unknown as Parameters<typeof TodoKanbanCard>[0]['subTodos']
        }
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(screen.getByText(/2\/3/)).toBeInTheDocument()
  })
})

describe('TodoKanbanCardOverlay', () => {
  it('todo.title 노출 + checkbox disabled', () => {
    render(<TodoKanbanCardOverlay todo={baseTodo} subTodos={[]} />)
    expect(screen.getByText('My Task')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('subTodos 있음 → done/total', () => {
    render(
      <TodoKanbanCardOverlay
        todo={baseTodo}
        subTodos={
          [
            { id: 's1', isDone: true },
            { id: 's2', isDone: false }
          ] as unknown as Parameters<typeof TodoKanbanCardOverlay>[0]['subTodos']
        }
      />
    )
    expect(screen.getByText(/1\/2/)).toBeInTheDocument()
  })

  it('description 있음 → 노출', () => {
    const withDesc = { ...baseTodo, description: '설명' } as unknown as Parameters<
      typeof TodoKanbanCardOverlay
    >[0]['todo']
    render(<TodoKanbanCardOverlay todo={withDesc} subTodos={[]} />)
    expect(screen.getByText('설명')).toBeInTheDocument()
  })

  it('dueDate 있음 → 날짜 (M.D) 형식 노출', () => {
    const withDue = {
      ...baseTodo,
      dueDate: new Date('2026-12-31')
    } as unknown as Parameters<typeof TodoKanbanCardOverlay>[0]['todo']
    const { container } = render(<TodoKanbanCardOverlay todo={withDue} subTodos={[]} />)
    // ko-KR 로케일 month/day 짧은 형식: "12. 31." (12.31. 같이 점 포함)
    expect(container.innerHTML).toMatch(/12.*31/)
  })

  it('isDone=true → line-through 클래스', () => {
    const done = { ...baseTodo, isDone: true } as unknown as Parameters<
      typeof TodoKanbanCardOverlay
    >[0]['todo']
    const { container } = render(<TodoKanbanCardOverlay todo={done} subTodos={[]} />)
    expect(container.innerHTML).toMatch(/line-through/)
  })
})
