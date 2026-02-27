import { TabContainer } from '@shared/ui/tab-container'
import TabHeader from '@shared/ui/tab-header'
import { Button } from '@shared/ui/button'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTodosByWorkspace, useUpdateTodo } from '@entities/todo'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { DeleteTodoDialog } from '@features/todo/delete-todo/ui/DeleteTodoDialog'
import { TodoDetailFields, SubTodoSection } from '@widgets/todo'

interface Props {
  tabId?: string
  params?: { todoId?: string }
}

export function TodoDetailPage({ tabId, params }: Props): React.JSX.Element {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const { data: todos = [], isLoading } = useTodosByWorkspace(workspaceId)
  const updateTodo = useUpdateTodo()
  const closeTab = useTabStore((s) => s.closeTab)
  const navigateTab = useTabStore((s) => s.navigateTab)
  const setTabTitle = useTabStore((s) => s.setTabTitle)
  const searchParams = useTabStore((s) => (tabId ? s.tabs[tabId]?.searchParams : undefined))

  const subtodoCollapse = searchParams?.subtodoCollapse !== 'false'

  function handleSubtodoCollapseChange(open: boolean): void {
    if (!tabId) return
    navigateTab(tabId, { searchParams: { ...searchParams, subtodoCollapse: String(open) } })
  }

  if (isLoading) {
    return (
      <TabContainer header={<TabHeader isLoading />}>
        <div />
      </TabContainer>
    )
  }

  const todo = todos.find((t) => t.id === params?.todoId)

  if (!todo) {
    return (
      <TabContainer header={<TabHeader title="할 일 상세" />}>
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          할 일을 찾을 수 없습니다
        </div>
      </TabContainer>
    )
  }

  const subTodos = todos
    .filter((t) => t.parentId === todo.id)
    .sort((a, b) => a.subOrder - b.subOrder)

  return (
    <TabContainer
      header={
        <TabHeader
          editable
          title={todo.title}
          onTitleChange={(newTitle) => {
            updateTodo.mutate({
              workspaceId: workspaceId!,
              todoId: todo.id,
              data: { title: newTitle }
            })
            if (tabId) setTabTitle(tabId, newTitle)
          }}
          description={todo.description}
          onDescriptionChange={(newDesc) =>
            updateTodo.mutate({
              workspaceId: workspaceId!,
              todoId: todo.id,
              data: { description: newDesc }
            })
          }
          buttons={
            <DeleteTodoDialog
              todoId={todo.id}
              workspaceId={workspaceId!}
              hasSubTodos={subTodos.length > 0}
              trigger={
                <Button variant="destructive" size="sm">
                  삭제
                </Button>
              }
              onDeleted={() => {
                if (tabId) closeTab(tabId)
              }}
            />
          }
        />
      }
    >
      <div className="flex flex-col gap-6 py-4">
        <TodoDetailFields todo={todo} workspaceId={workspaceId!} />

        <SubTodoSection
          todo={todo}
          subTodos={subTodos}
          workspaceId={workspaceId!}
          isOpen={subtodoCollapse}
          onOpenChange={handleSubtodoCollapseChange}
        />
      </div>
    </TabContainer>
  )
}
