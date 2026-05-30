/**
 * widgets/todo/ui/TodoSections.test.tsx — 4개 wrapper section 통합 테스트
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../TodoCompletedView', () => ({
  TodoCompletedView: () => <div data-testid="completed-view">completed</div>
}))
vi.mock('../TodoListView', () => ({
  TodoListView: () => <div data-testid="list-view">list</div>
}))
vi.mock('../TodoKanbanView', () => ({
  TodoKanbanView: () => <div data-testid="kanban-view">kanban</div>
}))
vi.mock('../TodoHoldingOnView', () => ({
  TodoHoldingOnView: () => <div data-testid="holdingon-view">holdingon</div>
}))
vi.mock('@features/todo/filter-todo/ui/TodoFilterBar', () => ({
  TodoFilterBar: () => <div data-testid="filter-bar">filter-bar</div>
}))

import { TodoCompletedSection } from '../TodoCompletedSection'
import { TodoListSection } from '../TodoListSection'
import { TodoKanbanSection } from '../TodoKanbanSection'
import { TodoHoldingOnSection } from '../TodoHoldingOnSection'
import { TodoFilterSection } from '../TodoFilterSection'

describe('TodoCompletedSection', () => {
  it('완료 개수 포함 타이틀 + view 렌더', () => {
    render(
      <TodoCompletedSection
        items={[{ id: 'a' }, { id: 'b' }] as never}
        workspaceId="ws1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('완료된 항목 (2개)')).toBeTruthy()
    expect(screen.getByTestId('completed-view')).toBeTruthy()
  })
})

describe('TodoListSection', () => {
  it('"목록" 타이틀 + list view', () => {
    render(
      <TodoListSection
        todos={[]}
        subTodoMap={new Map()}
        workspaceId="ws1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('목록')).toBeTruthy()
    expect(screen.getByTestId('list-view')).toBeTruthy()
  })
})

describe('TodoKanbanSection', () => {
  it('"칸반 보기" 타이틀 + kanban view', () => {
    render(
      <TodoKanbanSection
        todos={[]}
        subTodoMap={new Map()}
        columnMap={new Map()}
        workspaceId="ws1"
        filterActive={false}
        activeColumn={0}
        onColumnChange={vi.fn()}
        onItemClick={vi.fn()}
        onItemDelete={vi.fn()}
      />
    )
    expect(screen.getByText('칸반 보기')).toBeTruthy()
    expect(screen.getByTestId('kanban-view')).toBeTruthy()
  })
})

describe('TodoHoldingOnSection', () => {
  it('보류 개수 포함 타이틀 + holdingon view', () => {
    render(
      <TodoHoldingOnSection
        todos={[{ id: 'a' }] as never}
        workspaceId="ws1"
        filterActive={false}
        onItemClick={vi.fn()}
      />
    )
    expect(screen.getByText('보류 항목 (1개)')).toBeTruthy()
    expect(screen.getByTestId('holdingon-view')).toBeTruthy()
  })
})

describe('TodoFilterSection', () => {
  it('"필터" 타이틀 + filter-bar', () => {
    render(<TodoFilterSection filter={{} as never} onFilterChange={vi.fn()} />)
    expect(screen.getByText('필터')).toBeTruthy()
    expect(screen.getByTestId('filter-bar')).toBeTruthy()
  })
})
