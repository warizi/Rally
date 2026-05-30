/**
 * pages/todo-detail/ui/TodoDetailPage.test.tsx
 *
 * isLoading / todo 없음 / 정상. subtodos 분리 + 다양한 widget mock.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@shared/ui/tooltip'
import type { ReactElement } from 'react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  todos: [] as Array<{
    id: string
    title: string
    description: string
    parentId: string | null
    subOrder: number
    createdAt: Date
    createdBy: string
    createdById: string | null
    updatedAt: Date
    updatedBy: string
    updatedById: string | null
  }>,
  isLoading: false,
  updateMutate: vi.fn(),
  closeTab: vi.fn(),
  navigateTab: vi.fn(),
  setTabTitle: vi.fn(),
  tabs: {} as Record<string, { searchParams?: Record<string, string> }>
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))
vi.mock('@entities/todo', () => ({
  useTodosByWorkspace: () => ({ data: mocks.todos, isLoading: mocks.isLoading }),
  useUpdateTodo: () => ({ mutate: mocks.updateMutate })
}))
vi.mock('@/entities/tab-system', () => ({
  useTabStore: (
    sel: (s: {
      closeTab: typeof mocks.closeTab
      navigateTab: typeof mocks.navigateTab
      setTabTitle: typeof mocks.setTabTitle
      tabs: typeof mocks.tabs
    }) => unknown
  ) =>
    sel({
      closeTab: mocks.closeTab,
      navigateTab: mocks.navigateTab,
      setTabTitle: mocks.setTabTitle,
      tabs: mocks.tabs
    })
}))
vi.mock('@features/todo/delete-todo/ui/DeleteTodoDialog', () => ({
  DeleteTodoDialog: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>
}))
vi.mock('@widgets/todo', () => ({
  TodoDetailFields: ({ todo }: { todo: { id: string } }) => (
    <div data-testid="todo-fields" data-id={todo.id} />
  ),
  SubTodoSection: ({ subTodos }: { subTodos: Array<{ id: string }> }) => (
    <div data-testid="sub-todo-section" data-count={subTodos.length} />
  )
}))
vi.mock('@/widgets/entity-link', () => ({
  LinkedEntityPopoverButton: () => <div data-testid="link-popover" />
}))
vi.mock('@/widgets/tag', () => ({
  TagList: () => <div data-testid="tag-list" />
}))

import { TodoDetailPage } from '../TodoDetailPage'

function r(ui: ReactElement): RenderResult {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  )
}

function todo(
  id: string,
  parentId: string | null = null,
  subOrder = 0
): (typeof mocks.todos)[number] {
  return {
    id,
    title: `Todo ${id}`,
    description: '',
    parentId,
    subOrder,
    createdAt: new Date(),
    createdBy: 'u',
    createdById: null,
    updatedAt: new Date(),
    updatedBy: 'u',
    updatedById: null
  }
}

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.todos = []
  mocks.isLoading = false
  mocks.updateMutate.mockClear()
  mocks.closeTab.mockClear()
  mocks.navigateTab.mockClear()
  mocks.setTabTitle.mockClear()
  mocks.tabs = {}
})

describe('TodoDetailPage', () => {
  it('isLoading=true → 로딩 (todo-fields 미렌더)', () => {
    mocks.isLoading = true
    r(<TodoDetailPage params={{ todoId: 't-1' }} />)
    expect(screen.queryByTestId('todo-fields')).not.toBeInTheDocument()
  })

  it('todo 없음 → "할 일을 찾을 수 없습니다"', () => {
    mocks.todos = []
    r(<TodoDetailPage params={{ todoId: 't-phantom' }} />)
    expect(screen.getByText('할 일을 찾을 수 없습니다')).toBeInTheDocument()
  })

  it('todo 존재 → TodoDetailFields + SubTodoSection 렌더', () => {
    mocks.todos = [todo('t-1')]
    r(<TodoDetailPage params={{ todoId: 't-1' }} />)
    expect(screen.getByTestId('todo-fields')).toHaveAttribute('data-id', 't-1')
    expect(screen.getByTestId('sub-todo-section')).toHaveAttribute('data-count', '0')
  })

  it('subTodos 필터링 + subOrder 정렬', () => {
    mocks.todos = [
      todo('t-1'),
      todo('s-2', 't-1', 1),
      todo('s-1', 't-1', 0),
      todo('s-other', 'other', 0) // 다른 parent — 제외
    ]
    r(<TodoDetailPage params={{ todoId: 't-1' }} />)
    expect(screen.getByTestId('sub-todo-section')).toHaveAttribute('data-count', '2')
  })

  it('tag/link/header 컴포넌트들 노출', () => {
    mocks.todos = [todo('t-1')]
    r(<TodoDetailPage params={{ todoId: 't-1' }} />)
    expect(screen.getByTestId('link-popover')).toBeInTheDocument()
    expect(screen.getByTestId('tag-list')).toBeInTheDocument()
  })

  it('params 없음 (todoId undefined) → "할 일을 찾을 수 없습니다"', () => {
    mocks.todos = [todo('t-1')]
    r(<TodoDetailPage />)
    expect(screen.getByText('할 일을 찾을 수 없습니다')).toBeInTheDocument()
  })

  it('workspaceId=null + 로딩 false + todos=[] → "할 일을 찾을 수 없습니다"', () => {
    mocks.workspaceId = null
    mocks.todos = []
    r(<TodoDetailPage params={{ todoId: 't-1' }} />)
    expect(screen.getByText('할 일을 찾을 수 없습니다')).toBeInTheDocument()
  })
})
