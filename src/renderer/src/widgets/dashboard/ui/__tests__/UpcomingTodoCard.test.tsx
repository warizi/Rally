/**
 * widgets/dashboard/ui/UpcomingTodoCard.test.tsx
 *
 * useActiveTodosByWorkspace mock + dueDate 분류 (overdue/today/tomorrow).
 * 클릭 시 openTab(todo-detail) 호출.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  todos: [] as Array<{ id: string; title: string; dueDate: Date | null }>,
  openTab: vi.fn()
}))

vi.mock('@entities/todo', () => ({
  useActiveTodosByWorkspace: () => ({ data: mocks.todos, isLoading: false })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (sel: (s: { openTab: typeof mocks.openTab }) => unknown) =>
    sel({ openTab: mocks.openTab })
}))

import { UpcomingTodoCard } from '../UpcomingTodoCard'

const TODAY = new Date()
TODAY.setHours(12, 0, 0, 0)
const YESTERDAY = new Date(TODAY)
YESTERDAY.setDate(YESTERDAY.getDate() - 1)
const TOMORROW = new Date(TODAY)
TOMORROW.setDate(TOMORROW.getDate() + 1)

beforeEach(() => {
  mocks.todos = []
  mocks.openTab.mockClear()
})

describe('UpcomingTodoCard', () => {
  it('todos 모두 dueDate 없음 → "마감 임박 할 일이 없습니다"', () => {
    mocks.todos = [{ id: 't1', title: 'no due', dueDate: null }]
    render(<UpcomingTodoCard workspaceId="ws-1" />)
    expect(screen.getByText('마감 임박 할 일이 없습니다')).toBeInTheDocument()
  })

  it('지연된 todo → 지연 섹션에 표시', () => {
    mocks.todos = [{ id: 't1', title: '지연됨', dueDate: YESTERDAY }]
    render(<UpcomingTodoCard workspaceId="ws-1" />)
    expect(screen.getByText('지연')).toBeInTheDocument()
    expect(screen.getByText('지연됨')).toBeInTheDocument()
  })

  it('오늘 마감 → 오늘 섹션', () => {
    mocks.todos = [{ id: 't1', title: '오늘마감', dueDate: TODAY }]
    render(<UpcomingTodoCard workspaceId="ws-1" />)
    expect(screen.getByText('오늘')).toBeInTheDocument()
    expect(screen.getByText('오늘마감')).toBeInTheDocument()
  })

  it('내일 마감 → 내일 섹션', () => {
    mocks.todos = [{ id: 't1', title: '내일마감', dueDate: TOMORROW }]
    render(<UpcomingTodoCard workspaceId="ws-1" />)
    expect(screen.getByText('내일')).toBeInTheDocument()
    expect(screen.getByText('내일마감')).toBeInTheDocument()
  })

  it('항목 클릭 → openTab 호출 (todo-detail)', () => {
    mocks.todos = [{ id: 't1', title: '클릭', dueDate: TODAY }]
    render(<UpcomingTodoCard workspaceId="ws-1" />)
    fireEvent.click(screen.getByText('클릭'))
    expect(mocks.openTab).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'todo-detail', title: '클릭' })
    )
  })
})
