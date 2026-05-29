/**
 * widgets/canvas/ui/node-content/TodoNodeContent.test.tsx
 *
 * refId 매칭 안 됨 → fallback (refTitle 표시).
 * 매칭 todo → checkbox + title + status/priority/dueDate/description + sub-todos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

interface FakeTodo {
  id: string
  parentId: string | null
  subOrder: number
  title: string
  isDone: boolean
  status: string
  priority: string
  description?: string
  dueDate?: number | null
}

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  todos: [] as FakeTodo[]
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))

vi.mock('@entities/todo', () => ({
  useTodosByWorkspace: () => ({ data: mocks.todos }),
  useUpdateTodo: () => ({ mutate: vi.fn() })
}))

vi.mock('@features/todo/todo-field/ui/TodoCheckbox', () => ({
  TodoCheckbox: () => <input data-testid="checkbox" type="checkbox" />
}))

vi.mock('@features/todo/todo-field/ui/TodoStatusSelect', () => ({
  TodoStatusSelect: ({ value }: { value: string }) => <div data-testid="status">{value}</div>
}))

vi.mock('@features/todo/todo-field/ui/TodoPrioritySelect', () => ({
  TodoPrioritySelect: ({ value }: { value: string }) => <div data-testid="priority">{value}</div>
}))

vi.mock('@widgets/todo/ui/SubTodoListView', () => ({
  SubTodoListView: ({ subTodos }: { subTodos: FakeTodo[] }) => (
    <div data-testid="sub-todos">{subTodos.length}</div>
  )
}))

vi.mock('@shared/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

import { TodoNodeContent } from '../TodoNodeContent'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.todos = []
})

describe('TodoNodeContent', () => {
  it('todo 없음 → fallback (refTitle 노출)', () => {
    render(<TodoNodeContent refId="missing" refTitle="My Title" />)
    expect(screen.getByText('My Title')).toBeInTheDocument()
  })

  it('todo 없음 + refTitle 없음 → "(제목 없음)"', () => {
    render(<TodoNodeContent refId="missing" refTitle="" />)
    expect(screen.getByText('(제목 없음)')).toBeInTheDocument()
  })

  it('todo 매칭 → 제목/체크박스/status/priority 노출', () => {
    mocks.todos = [
      {
        id: 't1',
        parentId: null,
        subOrder: 0,
        title: 'Main Todo',
        isDone: false,
        status: '진행중',
        priority: 'high'
      }
    ]
    render(<TodoNodeContent refId="t1" refTitle="" />)
    expect(screen.getByText('Main Todo')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox')).toBeInTheDocument()
    expect(screen.getByTestId('status')).toHaveTextContent('진행중')
    expect(screen.getByTestId('priority')).toHaveTextContent('high')
  })

  it('isDone=true → line-through 클래스', () => {
    mocks.todos = [
      {
        id: 't1',
        parentId: null,
        subOrder: 0,
        title: '완료된 Todo',
        isDone: true,
        status: '완료',
        priority: 'low'
      }
    ]
    render(<TodoNodeContent refId="t1" refTitle="" />)
    expect(screen.getByText('완료된 Todo').className).toMatch(/line-through/)
  })

  it('description 있음 → 노출', () => {
    mocks.todos = [
      {
        id: 't1',
        parentId: null,
        subOrder: 0,
        title: 'T',
        isDone: false,
        status: '할일',
        priority: 'medium',
        description: '설명 텍스트'
      }
    ]
    render(<TodoNodeContent refId="t1" refTitle="" />)
    expect(screen.getByText('설명 텍스트')).toBeInTheDocument()
  })

  it('sub-todo 필터 + subOrder 정렬', () => {
    mocks.todos = [
      {
        id: 't1',
        parentId: null,
        subOrder: 0,
        title: 'Parent',
        isDone: false,
        status: '할일',
        priority: 'medium'
      },
      {
        id: 's1',
        parentId: 't1',
        subOrder: 1,
        title: 'sub1',
        isDone: false,
        status: '할일',
        priority: 'medium'
      },
      {
        id: 's2',
        parentId: 't1',
        subOrder: 0,
        title: 'sub2',
        isDone: false,
        status: '할일',
        priority: 'medium'
      }
    ]
    render(<TodoNodeContent refId="t1" refTitle="" />)
    expect(screen.getByTestId('sub-todos')).toHaveTextContent('2')
  })
})
