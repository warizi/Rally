/**
 * widgets/todo/ui/TodoKanbanView.test.tsx
 *
 * columnMap 기반 각 상태 board 렌더. carousel mode (좁은 화면) 분기.
 * smoke 테스트 — DnD 자체는 jsdom 한계.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn()
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: <T,>(arr: T[]) => arr
}))

vi.mock('@entities/todo', () => ({
  useReorderTodoKanban: () => ({ mutate: vi.fn() })
}))

vi.mock('../TodoKanbanBoard', () => ({
  TodoKanbanBoard: ({ status, todos }: { status: string; todos: Array<{ id: string }> }) => (
    <div data-testid={`board-${status}`}>{`${status}:${todos.length}`}</div>
  )
}))

vi.mock('../TodoKanbanCard', () => ({
  TodoKanbanCardOverlay: () => null
}))

vi.mock('../../model/use-todo-kanban', () => ({
  KANBAN_COLUMNS: ['할일', '진행중', '완료', '보류']
}))

import { TodoKanbanView } from '../TodoKanbanView'

const baseProps = {
  todos: [],
  subTodoMap: new Map(),
  columnMap: new Map([
    ['할일', [{ id: 't1' }, { id: 't2' }]],
    ['진행중', [{ id: 't3' }]],
    ['완료', []],
    ['보류', []]
  ]) as unknown as Parameters<typeof TodoKanbanView>[0]['columnMap'],
  workspaceId: 'ws',
  filterActive: false,
  activeColumn: 0,
  onColumnChange: vi.fn(),
  onItemClick: vi.fn(),
  onItemDelete: vi.fn()
}

describe('TodoKanbanView', () => {
  it('4개 컬럼 (KANBAN_COLUMNS) 별로 TodoKanbanBoard 렌더 (carousel + regular = 중복 OK)', () => {
    render(<TodoKanbanView {...baseProps} />)
    expect(screen.getAllByTestId('board-할일').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-진행중').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-완료').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-보류').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-할일')[0]).toHaveTextContent('할일:2')
  })

  it('컬럼 데이터 비었음 → 카운트 0', () => {
    const emptyMap = new Map([
      ['할일', []],
      ['진행중', []],
      ['완료', []],
      ['보류', []]
    ]) as unknown as Parameters<typeof TodoKanbanView>[0]['columnMap']
    render(<TodoKanbanView {...baseProps} columnMap={emptyMap} />)
    expect(screen.getAllByTestId('board-할일')[0]).toHaveTextContent('할일:0')
  })

  it('DragOverlay 렌더 (활성 카드 없음)', () => {
    render(<TodoKanbanView {...baseProps} />)
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })

  it('큰 컬럼 (todos > 5개) 렌더 → 카운트 정확', () => {
    const bigMap = new Map([
      ['할일', Array.from({ length: 10 }, (_, i) => ({ id: `t${i}` }))],
      ['진행중', []],
      ['완료', []],
      ['보류', []]
    ]) as unknown as Parameters<typeof TodoKanbanView>[0]['columnMap']
    render(<TodoKanbanView {...baseProps} columnMap={bigMap} />)
    expect(screen.getAllByTestId('board-할일')[0]).toHaveTextContent('할일:10')
  })

  it('filterActive=true → smoke 렌더 (4 보드 모두)', () => {
    render(<TodoKanbanView {...baseProps} filterActive={true} />)
    expect(screen.getAllByTestId('board-할일').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('board-진행중').length).toBeGreaterThan(0)
  })

  it('activeColumn=2 → smoke 렌더 (다른 활성 컬럼)', () => {
    render(<TodoKanbanView {...baseProps} activeColumn={2} />)
    expect(screen.getAllByTestId('board-완료').length).toBeGreaterThan(0)
  })

  it('onItemClick / onItemDelete props 정의 → 즉시 호출 안 됨 (smoke)', () => {
    const onItemClick = vi.fn()
    const onItemDelete = vi.fn()
    render(<TodoKanbanView {...baseProps} onItemClick={onItemClick} onItemDelete={onItemDelete} />)
    expect(onItemClick).not.toHaveBeenCalled()
    expect(onItemDelete).not.toHaveBeenCalled()
  })
})
