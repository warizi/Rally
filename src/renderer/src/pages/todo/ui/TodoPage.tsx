import { useState } from 'react'
import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@/shared/ui/tab-header'
import { ROUTES } from '@shared/constants/tab-url'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTodosByWorkspace, useActiveTodosByWorkspace } from '@entities/todo'
import { useCompletedWithRecurring, type CompletedItem } from '@entities/recurring-completion'
import { useTabStore, selectPaneByTabId } from '@features/tap-system/manage-tab-system'
import { useTodoList } from '@features/todo/todo-list/model/use-todo-list'
import { useCompletedTodoList } from '@features/todo/todo-list/model/use-completed-todo-list'
import { useHoldingOnTodoList } from '@features/todo/todo-list/model/use-holding-on-todo-list'
import { useTodoKanban } from '@features/todo/todo-kanban/model/use-todo-kanban'
import {
  filterToParams,
  filterFromParams,
  type TodoFilter
} from '@features/todo/filter-todo/model/todo-filter'
import {
  TodoViewToolbar,
  TodoFilterSection,
  TodoListSection,
  TodoCompletedSection,
  TodoHoldingOnSection,
  TodoKanbanSection,
  RecurringTodoSection
} from '@widgets/todo'

type ViewMode = 'list' | 'kanban'

interface Props {
  tabId?: string
}

export function TodoPage({ tabId }: Props): React.JSX.Element {
  const tabSearchParams = useTabStore((s) => (tabId ? s.tabs[tabId]?.searchParams : undefined))
  const navigateTab = useTabStore((s) => s.navigateTab)
  const [view, setView] = useState<ViewMode>(tabSearchParams?.view === 'kanban' ? 'kanban' : 'list')
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const { data: todos = [] } = useTodosByWorkspace(workspaceId)
  const { data: activeTodos = [] } = useActiveTodosByWorkspace(workspaceId)
  const { data: completedItems = [] } = useCompletedWithRecurring(workspaceId)

  const openTab = useTabStore((s) => s.openTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)
  const findTabByPathname = useTabStore((s) => s.findTabByPathname)
  const pane = useTabStore(selectPaneByTabId(tabId ?? ''))

  function handleViewChange(newView: ViewMode): void {
    setView(newView)
    if (tabId) {
      navigateTab(tabId, { searchParams: { ...tabSearchParams, view: newView } })
    }
  }

  function makeTodoTabOptions(todoId: string): {
    type: 'todo-detail'
    pathname: string
    title: string
  } {
    const todo = todos.find((t) => t.id === todoId)
    return {
      type: 'todo-detail' as const,
      pathname: ROUTES.TODO_DETAIL.replace(':todoId', todoId),
      title: todo?.title ?? '할 일 상세'
    }
  }

  const handleItemClick = (todoId: string): string => {
    const options = makeTodoTabOptions(todoId)
    const existing = findTabByPathname(options.pathname)
    if (existing) closeTab(existing.id)
    return openTab(options, pane?.id)
  }

  const handleOpenInPane = (todoId: string, paneId: string): void => {
    const options = makeTodoTabOptions(todoId)
    const existing = findTabByPathname(options.pathname)
    if (existing) closeTab(existing.id)
    openTab(options, paneId)
  }

  const handleItemDeleted = (todoId: string): void =>
    closeTabByPathname(ROUTES.TODO_DETAIL.replace(':todoId', todoId))

  const initialKanbanColumn = Math.min(3, Math.max(0, Number(tabSearchParams?.kanbanColumn ?? 0)))
  const initialListFilter = filterFromParams(tabSearchParams, 'list')
  const initialKanbanFilter = filterFromParams(tabSearchParams, 'kanban')

  const listState = useTodoList(activeTodos, initialListFilter)
  const holdingOnState = useHoldingOnTodoList(activeTodos, listState.filter)
  const completedTodoItems = completedItems
    .filter((i): i is Extract<CompletedItem, { type: 'todo' }> => i.type === 'todo')
    .map((i) => i.todo)
  const completedState = useCompletedTodoList(completedTodoItems, listState.filter)
  const kanbanState = useTodoKanban(todos, initialKanbanColumn, initialKanbanFilter)

  const kanbanFilterOpen = tabSearchParams?.kanbanFilterOpen !== 'false'
  const kanbanViewOpen = tabSearchParams?.kanbanViewOpen !== 'false'
  const listFilterOpen = tabSearchParams?.listFilterOpen !== 'false'
  const listViewOpen = tabSearchParams?.listViewOpen !== 'false'
  const holdingOnOpen = tabSearchParams?.holdingOnOpen === 'true'
  const completedOpen = tabSearchParams?.completedOpen === 'true'
  const recurringOpen = tabSearchParams?.recurringOpen !== 'false'

  const today = new Date()

  function handleSectionToggle(key: string, open: boolean): void {
    if (tabId) {
      navigateTab(tabId, { searchParams: { ...tabSearchParams, [key]: String(open) } })
    }
  }

  function handleListFilterChange(filter: TodoFilter): void {
    listState.setFilter(filter)
    if (tabId) {
      navigateTab(tabId, {
        searchParams: { ...tabSearchParams, ...filterToParams(filter, 'list') }
      })
    }
  }

  function handleKanbanFilterChange(filter: TodoFilter): void {
    kanbanState.setFilter(filter)
    if (tabId) {
      navigateTab(tabId, {
        searchParams: { ...tabSearchParams, ...filterToParams(filter, 'kanban') }
      })
    }
  }

  // Build filtered CompletedItem[] for the completed section
  const filteredCompletedItems = completedState.filterActive
    ? completedItems.filter((item) => {
        if (item.type === 'recurring') return true
        return completedState.filteredCompleted.some((t) => t.id === item.todo.id)
      })
    : completedItems

  return (
    <TabContainer
      scrollable={view !== 'kanban'}
      header={
        <TabHeader
          title="할 일"
          description="할 일 목록을 관리하는 페이지입니다."
          buttons={
            <TodoViewToolbar
              view={view}
              onViewChange={handleViewChange}
              workspaceId={workspaceId}
            />
          }
        />
      }
    >
      {!workspaceId ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          워크스페이스를 선택해주세요
        </div>
      ) : view === 'kanban' ? (
        <div className="flex flex-col gap-3 pt-3 h-full overflow-hidden">
          <TodoFilterSection
            filter={kanbanState.filter}
            onFilterChange={handleKanbanFilterChange}
            showStatus={false}
            open={kanbanFilterOpen}
            onOpenChange={(o) => handleSectionToggle('kanbanFilterOpen', o)}
          />
          <TodoKanbanSection
            todos={todos}
            subTodoMap={kanbanState.subTodoMap}
            columnMap={kanbanState.columnMap}
            workspaceId={workspaceId}
            filterActive={kanbanState.filterActive}
            activeColumn={kanbanState.activeColumn}
            onColumnChange={(i) => {
              kanbanState.setActiveColumn(i)
              if (tabId) {
                navigateTab(tabId, {
                  searchParams: { ...tabSearchParams, kanbanColumn: String(i) }
                })
              }
            }}
            onItemClick={handleItemClick}
            onOpenInPane={handleOpenInPane}
            onItemDelete={handleItemDeleted}
            open={kanbanViewOpen}
            onOpenChange={(o) => handleSectionToggle('kanbanViewOpen', o)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-3">
          <TodoFilterSection
            filter={listState.filter}
            onFilterChange={handleListFilterChange}
            showStatus={true}
            open={listFilterOpen}
            onOpenChange={(o) => handleSectionToggle('listFilterOpen', o)}
          />
          <RecurringTodoSection
            workspaceId={workspaceId}
            date={today}
            open={recurringOpen}
            onOpenChange={(o) => handleSectionToggle('recurringOpen', o)}
          />
          <TodoListSection
            todos={listState.filteredTopLevel}
            subTodoMap={listState.subTodoMap}
            workspaceId={workspaceId}
            filterActive={listState.filterActive}
            onItemClick={handleItemClick}
            onOpenInPane={handleOpenInPane}
            onItemDeleted={handleItemDeleted}
            open={listViewOpen}
            onOpenChange={(o) => handleSectionToggle('listViewOpen', o)}
          />
          <TodoHoldingOnSection
            todos={holdingOnState.filteredHoldingOn}
            workspaceId={workspaceId}
            filterActive={holdingOnState.filterActive}
            onItemClick={handleItemClick}
            onOpenInPane={handleOpenInPane}
            onItemDeleted={handleItemDeleted}
            open={holdingOnOpen}
            onOpenChange={(o) => handleSectionToggle('holdingOnOpen', o)}
          />
          <TodoCompletedSection
            items={filteredCompletedItems}
            workspaceId={workspaceId}
            filterActive={completedState.filterActive}
            onItemClick={handleItemClick}
            onOpenInPane={handleOpenInPane}
            onItemDeleted={handleItemDeleted}
            open={completedOpen}
            onOpenChange={(o) => handleSectionToggle('completedOpen', o)}
          />
        </div>
      )}
    </TabContainer>
  )
}
