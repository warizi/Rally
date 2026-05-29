/**
 * widgets/todo/ui/TodoKanbanBoard.test.tsx
 *
 * status 라벨 + 카운트 + 각 TodoKanbanCard 매핑.
 * CreateTodoDialog trigger 노출. (DnD는 jsdom 한계 — smoke만)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false })
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {}
}))

vi.mock('../TodoKanbanCard', () => ({
  TodoKanbanCard: ({ todo }: { todo: { id: string; title: string } }) => (
    <div data-testid={`card-${todo.id}`}>{todo.title}</div>
  )
}))

vi.mock('../CreateTodoDialog', () => ({
  CreateTodoDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>
}))

vi.mock('@/shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

import { TodoKanbanBoard } from '../TodoKanbanBoard'

const baseProps = {
  status: '할일' as const,
  todos: [],
  subTodoMap: new Map(),
  workspaceId: 'ws',
  onItemClick: vi.fn(),
  onItemDelete: vi.fn()
}

describe('TodoKanbanBoard', () => {
  it('status 라벨 + 카운트 노출', () => {
    render(
      <TodoKanbanBoard
        {...baseProps}
        todos={
          [
            { id: 't1', title: 'A' },
            { id: 't2', title: 'B' }
          ] as unknown as Parameters<typeof TodoKanbanBoard>[0]['todos']
        }
      />
    )
    expect(screen.getByText('할일')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('todos 매핑 → 각 TodoKanbanCard 렌더', () => {
    render(
      <TodoKanbanBoard
        {...baseProps}
        todos={
          [{ id: 't1', title: 'Task A' }] as unknown as Parameters<
            typeof TodoKanbanBoard
          >[0]['todos']
        }
      />
    )
    expect(screen.getByTestId('card-t1')).toHaveTextContent('Task A')
  })

  it('빈 todos → 카운트 0 + 카드 미렌더', () => {
    render(<TodoKanbanBoard {...baseProps} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.queryByTestId(/^card-/)).not.toBeInTheDocument()
  })

  it('status="진행중" → 라벨 노출', () => {
    render(<TodoKanbanBoard {...baseProps} status="진행중" />)
    expect(screen.getByText('진행중')).toBeInTheDocument()
  })

  it('status="완료" → 라벨', () => {
    render(<TodoKanbanBoard {...baseProps} status="완료" />)
    expect(screen.getByText('완료')).toBeInTheDocument()
  })

  it('status="보류" → 라벨', () => {
    render(<TodoKanbanBoard {...baseProps} status="보류" />)
    expect(screen.getByText('보류')).toBeInTheDocument()
  })
})
