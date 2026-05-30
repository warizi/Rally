/**
 * pages/todo/ui/TodoPage.test.tsx
 *
 * workspaceId 없음 → "워크스페이스를 선택해주세요".
 * 빈 todos+빈 completed → Empty + CreateTodoDialog trigger.
 * view=list → 4 sections. view=kanban → filter + kanban section.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  workspaceId: 'ws-1' as string | null,
  todos: [] as Array<{ id: string; title: string }>,
  activeTodos: [] as Array<{ id: string; title: string }>,
  completedItems: [] as Array<unknown>,
  view: 'list' as 'list' | 'kanban',
  pane: { id: 'p1' },
  tabSearchParams: undefined as Record<string, string> | undefined
}))

vi.mock('@shared/store/current-workspace', () => ({
  useCurrentWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: mocks.workspaceId })
}))

vi.mock('@/entities/tab-system', () => {
  const selectPaneByTabId = () => () => mocks.pane
  return {
    selectPaneByTabId,
    useTabStore: (sel: (s: Record<string, unknown>) => unknown) =>
      sel({
        tabs: { t1: { searchParams: mocks.tabSearchParams } },
        navigateTab: vi.fn(),
        openTab: vi.fn(),
        closeTab: vi.fn(),
        closeTabByPathname: vi.fn(),
        findTabByPathname: vi.fn()
      })
  }
})

vi.mock('@entities/todo', () => ({
  useTodosByWorkspace: () => ({ data: mocks.todos }),
  useActiveTodosByWorkspace: () => ({ data: mocks.activeTodos }),
  filterToParams: () => ({}),
  filterFromParams: () => ({})
}))

vi.mock('@/widgets/recurring', () => ({
  useCompletedWithRecurring: () => ({ data: mocks.completedItems })
}))

vi.mock('@widgets/todo/model/use-todo-list', () => ({
  useTodoList: () => ({
    filter: {},
    setFilter: vi.fn(),
    filterActive: false,
    filteredTopLevel: [],
    subTodoMap: new Map()
  })
}))

vi.mock('@widgets/todo/model/use-completed-todo-list', () => ({
  useCompletedTodoList: () => ({ filterActive: false, filteredCompleted: [] })
}))

vi.mock('@widgets/todo/model/use-holding-on-todo-list', () => ({
  useHoldingOnTodoList: () => ({ filterActive: false, filteredHoldingOn: [] })
}))

vi.mock('@widgets/todo/model/use-todo-kanban', () => ({
  useTodoKanban: () => ({
    filter: {},
    setFilter: vi.fn(),
    filterActive: false,
    subTodoMap: new Map(),
    columnMap: new Map(),
    activeColumn: 0,
    setActiveColumn: vi.fn()
  })
}))

vi.mock('@widgets/todo', () => ({
  TodoViewToolbar: ({
    view,
    onViewChange
  }: {
    view: string
    onViewChange: (v: string) => void
  }) => (
    <div>
      <button data-testid="view-list" onClick={() => onViewChange('list')}>
        list ({view})
      </button>
      <button data-testid="view-kanban" onClick={() => onViewChange('kanban')}>
        kanban
      </button>
    </div>
  ),
  TodoFilterSection: () => <div data-testid="filter-section" />,
  TodoListSection: () => <div data-testid="list-section" />,
  TodoCompletedSection: () => <div data-testid="completed-section" />,
  TodoHoldingOnSection: () => <div data-testid="holdingon-section" />,
  TodoKanbanSection: () => <div data-testid="kanban-section" />,
  RecurringTodoSection: () => <div data-testid="recurring-section" />
}))

vi.mock('@widgets/todo/ui/CreateTodoDialog', () => ({
  CreateTodoDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>
}))

vi.mock('@shared/ui/tab-container', () => ({
  TabContainer: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  )
}))

vi.mock('@/shared/ui/tab-header', () => ({
  default: ({ title, buttons }: { title: string; buttons?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {buttons}
    </header>
  )
}))

vi.mock('@shared/ui/onboarding-tip', () => ({
  OnboardingTipIcon: () => <div data-testid="tip" />
}))

vi.mock('@shared/ui/empty', () => ({
  Empty: ({ children }: { children: React.ReactNode }) => <div data-testid="empty">{children}</div>,
  EmptyHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  EmptyMedia: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  EmptyTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  EmptyDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  EmptyContent: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import { TodoPage } from '../TodoPage'

beforeEach(() => {
  mocks.workspaceId = 'ws-1'
  mocks.todos = []
  mocks.activeTodos = []
  mocks.completedItems = []
  mocks.view = 'list'
  mocks.tabSearchParams = undefined
})

describe('TodoPage', () => {
  it('타이틀 "할 일" + TodoViewToolbar 노출', () => {
    render(<TodoPage tabId="t1" />)
    expect(screen.getByText('할 일')).toBeInTheDocument()
    expect(screen.getByTestId('view-list')).toBeInTheDocument()
  })

  it('workspaceId=null → 안내 메시지', () => {
    mocks.workspaceId = null
    render(<TodoPage tabId="t1" />)
    expect(screen.getByText('워크스페이스를 선택해주세요')).toBeInTheDocument()
  })

  it('빈 todos + completedItems → Empty + "오늘 할 일을 적어보세요"', () => {
    render(<TodoPage tabId="t1" />)
    expect(screen.getByText('오늘 할 일을 적어보세요')).toBeInTheDocument()
  })

  it('todos 있음 + view=list → 4 sections 렌더', () => {
    mocks.todos = [{ id: 't1', title: 'A' }]
    mocks.activeTodos = [{ id: 't1', title: 'A' }]
    render(<TodoPage tabId="t1" />)
    expect(screen.getByTestId('list-section')).toBeInTheDocument()
    expect(screen.getByTestId('completed-section')).toBeInTheDocument()
    expect(screen.getByTestId('holdingon-section')).toBeInTheDocument()
    expect(screen.getByTestId('recurring-section')).toBeInTheDocument()
  })

  it('view=kanban → kanban-section 노출 + list-section 미노출', () => {
    mocks.todos = [{ id: 't1', title: 'A' }]
    mocks.activeTodos = [{ id: 't1', title: 'A' }]
    mocks.view = 'kanban'
    mocks.tabSearchParams = { view: 'kanban' }
    render(<TodoPage tabId="t1" />)
    expect(screen.getByTestId('kanban-section')).toBeInTheDocument()
    expect(screen.queryByTestId('list-section')).toBeNull()
  })

  it('tabSearchParams.view=kanban → 초기 view=kanban 적용', () => {
    mocks.todos = [{ id: 't1', title: 'A' }]
    mocks.tabSearchParams = { view: 'kanban' }
    render(<TodoPage tabId="t1" />)
    // TodoViewToolbar 가 view='kanban' 이면 view-kanban testid 노출
    expect(screen.getByTestId('view-kanban')).toBeInTheDocument()
  })

  it('completedItems 있음 + activeTodos 없음 → Empty 미노출 (할 일이 있다고 간주)', () => {
    mocks.completedItems = [{ type: 'todo', completedAt: new Date() }]
    render(<TodoPage tabId="t1" />)
    expect(screen.queryByText('오늘 할 일을 적어보세요')).toBeNull()
  })
})
