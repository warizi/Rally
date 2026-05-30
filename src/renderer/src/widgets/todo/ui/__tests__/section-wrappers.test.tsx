/**
 * widgets/todo/ui/section-wrappers.test.tsx
 *
 * Thin CollapsibleSection wrappers — TodoFilterSection / TodoCompletedSection /
 * TodoHoldingOnSection / TodoListSection / TodoKanbanSection.
 * 각 컴포넌트가 child 를 노출하는지 + 카운트 라벨 정확성만 확인.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@shared/ui/collapsible-section', () => ({
  CollapsibleSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section data-testid="collapsible">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  )
}))

vi.mock('@features/todo/filter-todo/ui/TodoFilterBar', () => ({
  TodoFilterBar: () => <div data-testid="filter-bar" />
}))
vi.mock('../TodoCompletedView', () => ({
  TodoCompletedView: () => <div data-testid="completed-view" />
}))
vi.mock('../TodoHoldingOnView', () => ({
  TodoHoldingOnView: () => <div data-testid="holding-view" />
}))
vi.mock('../TodoListView', () => ({
  TodoListView: () => <div data-testid="list-view" />
}))
vi.mock('../TodoKanbanView', () => ({
  TodoKanbanView: () => <div data-testid="kanban-view" />
}))

import { TodoFilterSection } from '../TodoFilterSection'
import { TodoCompletedSection } from '../TodoCompletedSection'
import { TodoHoldingOnSection } from '../TodoHoldingOnSection'
import { TodoListSection } from '../TodoListSection'
import { TodoKanbanSection } from '../TodoKanbanSection'

describe('TodoFilterSection', () => {
  it('"필터" 타이틀 + TodoFilterBar 렌더', () => {
    render(<TodoFilterSection filter={{} as never} onFilterChange={vi.fn()} />)
    expect(screen.getByText('필터')).toBeInTheDocument()
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
  })
})

describe('TodoCompletedSection', () => {
  it('items.length 라벨 + child 렌더', () => {
    render(
      <TodoCompletedSection
        items={[{ id: 'a' } as never, { id: 'b' } as never]}
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('완료된 항목 (2개)')).toBeInTheDocument()
    expect(screen.getByTestId('completed-view')).toBeInTheDocument()
  })

  it('items 비어있음 → 0개', () => {
    render(
      <TodoCompletedSection
        items={[]}
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('완료된 항목 (0개)')).toBeInTheDocument()
  })
})

describe('TodoHoldingOnSection', () => {
  it('todos.length 라벨 + child 렌더', () => {
    render(
      <TodoHoldingOnSection
        todos={[{ id: 'a' } as never, { id: 'b' } as never, { id: 'c' } as never]}
        workspaceId="ws"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('보류 항목 (3개)')).toBeInTheDocument()
    expect(screen.getByTestId('holding-view')).toBeInTheDocument()
  })
})

describe('TodoListSection', () => {
  it('"목록" 타이틀 + TodoListView 렌더', () => {
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
})

describe('TodoKanbanSection', () => {
  it('"칸반 보기" 타이틀 + TodoKanbanView 렌더', () => {
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
