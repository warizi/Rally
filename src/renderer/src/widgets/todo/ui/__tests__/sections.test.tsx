/**
 * widgets/todo/ui/sections.test.tsx
 *
 * 5개 CollapsibleSection 래퍼 (TodoCompleted/TodoList/TodoFilter/TodoHoldingOn/TodoKanban) 동시 검증.
 * 자식 view stub 으로 prop 전파만 확인.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/ui/collapsible-section', () => ({
  CollapsibleSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  )
}))

vi.mock('../TodoCompletedView', () => ({
  TodoCompletedView: () => <div data-testid="completed-view" />
}))

vi.mock('../TodoListView', () => ({
  TodoListView: () => <div data-testid="list-view" />
}))

vi.mock('../TodoHoldingOnView', () => ({
  TodoHoldingOnView: () => <div data-testid="holdingon-view" />
}))

vi.mock('../TodoKanbanView', () => ({
  TodoKanbanView: () => <div data-testid="kanban-view" />
}))

vi.mock('@features/todo/filter-todo/ui/TodoFilterBar', () => ({
  TodoFilterBar: () => <div data-testid="filter-bar" />
}))

import { TodoCompletedSection } from '../TodoCompletedSection'
import { TodoListSection } from '../TodoListSection'
import { TodoFilterSection } from '../TodoFilterSection'
import { TodoHoldingOnSection } from '../TodoHoldingOnSection'
import { TodoKanbanSection } from '../TodoKanbanSection'

describe('Todo Sections', () => {
  it('TodoCompletedSection — 카운트 + 자식 view', () => {
    render(
      <TodoCompletedSection
        items={
          [
            { id: 'a', todoId: 'a', completedAt: 0 },
            { id: 'b', todoId: 'b', completedAt: 0 }
          ] as unknown as Parameters<typeof TodoCompletedSection>[0]['items']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('완료된 항목 (2개)')).toBeInTheDocument()
    expect(screen.getByTestId('completed-view')).toBeInTheDocument()
  })

  it('TodoListSection — "목록" 타이틀 + 자식 view', () => {
    render(
      <TodoListSection
        todos={[]}
        subTodoMap={new Map()}
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('목록')).toBeInTheDocument()
    expect(screen.getByTestId('list-view')).toBeInTheDocument()
  })

  it('TodoFilterSection — "필터" 타이틀 + filter-bar', () => {
    render(
      <TodoFilterSection
        filter={{} as unknown as Parameters<typeof TodoFilterSection>[0]['filter']}
        onFilterChange={vi.fn()}
      />
    )
    expect(screen.getByText('필터')).toBeInTheDocument()
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
  })

  it('TodoHoldingOnSection — 카운트 + 자식 view', () => {
    render(
      <TodoHoldingOnSection
        todos={
          [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as unknown as Parameters<
            typeof TodoHoldingOnSection
          >[0]['todos']
        }
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('보류 항목 (3개)')).toBeInTheDocument()
    expect(screen.getByTestId('holdingon-view')).toBeInTheDocument()
  })

  it('TodoKanbanSection — "칸반 보기" + 자식 view', () => {
    render(
      <TodoKanbanSection
        todos={[]}
        subTodoMap={new Map()}
        columnMap={new Map()}
        workspaceId="ws"
        filterActive={false}
        activeColumn={0}
        onColumnChange={vi.fn()}
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(screen.getByText('칸반 보기')).toBeInTheDocument()
    expect(screen.getByTestId('kanban-view')).toBeInTheDocument()
  })
})
