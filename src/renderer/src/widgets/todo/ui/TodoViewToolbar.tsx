import { LayoutList, LayoutGrid } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { CreateTodoDialog } from '@features/todo/create-todo/ui/CreateTodoDialog'

type ViewMode = 'list' | 'kanban'

interface Props {
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  workspaceId: string | null
}

export function TodoViewToolbar({ view, onViewChange, workspaceId }: Props): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={view === 'list' ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => onViewChange('list')}
      >
        <LayoutList className="h-4 w-4" />
      </Button>
      <Button
        variant={view === 'kanban' ? 'secondary' : 'ghost'}
        size="icon"
        onClick={() => onViewChange('kanban')}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      {workspaceId && (
        <CreateTodoDialog workspaceId={workspaceId} trigger={<Button size="sm">+ 추가</Button>} />
      )}
    </div>
  )
}
