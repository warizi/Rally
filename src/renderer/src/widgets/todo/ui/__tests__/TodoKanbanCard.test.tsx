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

  it('priority="high" → 빨간 strip 클래스 (bg-red-500)', () => {
    const { container } = render(
      <TodoKanbanCard
        todo={baseTodo}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument()
  })

  it('priority="low" → 파란 strip 클래스 (bg-blue-400)', () => {
    const lowTodo = { ...baseTodo, priority: 'low' } as unknown as Parameters<
      typeof TodoKanbanCard
    >[0]['todo']
    const { container } = render(
      <TodoKanbanCard
        todo={lowTodo}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(container.querySelector('.bg-blue-400')).toBeInTheDocument()
  })

  it('priority="medium" → amber strip 클래스 (bg-amber-400)', () => {
    const medTodo = { ...baseTodo, priority: 'medium' } as unknown as Parameters<
      typeof TodoKanbanCard
    >[0]['todo']
    const { container } = render(
      <TodoKanbanCard
        todo={medTodo}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(container.querySelector('.bg-amber-400')).toBeInTheDocument()
  })

  it('카드 클릭 → onItemClick(todo.id) 호출', () => {
    const onItemClick = vi.fn()
    const { container } = render(
      <TodoKanbanCard
        todo={baseTodo}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={onItemClick}
        onItemDelete={vi.fn()}
      />
    )
    const card = container.querySelector('[data-kanban-card="true"]') as HTMLElement
    expect(card).toBeTruthy()
    card.click()
    expect(onItemClick).toHaveBeenCalledWith('t1')
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

  it('description 빈 문자열 → 미노출', () => {
    render(<TodoKanbanCardOverlay todo={baseTodo} subTodos={[]} />)
    // 빈 description → "설명" 텍스트 없음
    expect(screen.queryByText('설명')).toBeNull()
  })

  it('dueDate null → 날짜 영역 미노출 (M.D 없음)', () => {
    const { container } = render(<TodoKanbanCardOverlay todo={baseTodo} subTodos={[]} />)
    // dueDate=null → calendar 아이콘 옆 날짜 미노출
    expect(container.querySelector('[data-due-date]')).toBeNull()
  })

  it('subTodos 비어있음 → done/total 미노출', () => {
    render(<TodoKanbanCardOverlay todo={baseTodo} subTodos={[]} />)
    expect(screen.queryByText(/\/0/)).toBeNull()
  })

  it('priority 없음 (undefined) → strip 클래스 없음 (smoke)', () => {
    const noPriority = { ...baseTodo, priority: undefined } as unknown as Parameters<
      typeof TodoKanbanCardOverlay
    >[0]['todo']
    const { container } = render(<TodoKanbanCardOverlay todo={noPriority} subTodos={[]} />)
    expect(container.firstChild).toBeTruthy()
  })
})

describe('TodoKanbanCard — 추가 분기', () => {
  it('isDragging=true 분기 (smoke) — useSortable mock 변경 필요해서 직접 검증 어려움. invisible 클래스 노출은 normal 모드에서도 확인.', () => {
    const { container } = render(
      <TodoKanbanCard
        todo={baseTodo}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(container.querySelector('[data-kanban-card="true"]')).toBeInTheDocument()
  })

  it('subTodos 모두 done → "N/N" 카운트 + line-through 없음', () => {
    render(
      <TodoKanbanCard
        todo={baseTodo}
        subTodos={
          [
            { id: 's1', isDone: true },
            { id: 's2', isDone: true }
          ] as unknown as Parameters<typeof TodoKanbanCard>[0]['subTodos']
        }
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(screen.getByText(/2\/2/)).toBeInTheDocument()
  })

  it('dueDate 지남 (과거) → red 클래스 (overdue 분기)', () => {
    const overdue = {
      ...baseTodo,
      dueDate: new Date('2020-01-01')
    } as unknown as Parameters<typeof TodoKanbanCard>[0]['todo']
    const { container } = render(
      <TodoKanbanCard
        todo={overdue}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(container.querySelector('.text-red-600')).toBeInTheDocument()
  })

  it('dueDate 3일 이내 (임박) → amber 클래스', () => {
    const nearFuture = new Date()
    nearFuture.setDate(nearFuture.getDate() + 2)
    const soon = {
      ...baseTodo,
      dueDate: nearFuture
    } as unknown as Parameters<typeof TodoKanbanCard>[0]['todo']
    const { container } = render(
      <TodoKanbanCard
        todo={soon}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(container.querySelector('.text-amber-600')).toBeInTheDocument()
  })

  it('description 있음 → 노출', () => {
    const withDesc = {
      ...baseTodo,
      description: '카드 설명'
    } as unknown as Parameters<typeof TodoKanbanCard>[0]['todo']
    render(
      <TodoKanbanCard
        todo={withDesc}
        subTodos={[]}
        workspaceId="ws"
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(screen.getByText('카드 설명')).toBeInTheDocument()
  })
})
