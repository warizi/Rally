import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useActiveTodosByWorkspace } from '@entities/todo'
import type { TodoItem } from '@entities/todo'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ROUTES } from '@shared/constants/tab-url'
import { DashboardCard } from '@shared/ui/dashboard-card'
import { Separator } from '@shared/ui/separator'

interface UpcomingTodoCardProps {
  workspaceId: string
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const SECTION_CONFIG = [
  {
    key: 'overdue',
    label: '지연',
    dotClass: 'bg-destructive',
    labelClass: 'text-destructive'
  },
  {
    key: 'todayDue',
    label: '오늘',
    dotClass: 'bg-chart-1',
    labelClass: 'text-foreground'
  },
  {
    key: 'tomorrowDue',
    label: '내일',
    dotClass: 'bg-muted-foreground/50',
    labelClass: 'text-muted-foreground'
  }
] as const

export function UpcomingTodoCard({ workspaceId }: UpcomingTodoCardProps): React.JSX.Element {
  const { data: todos = [], isLoading } = useActiveTodosByWorkspace(workspaceId)
  const openTab = useTabStore((s) => s.openTab)

  const groups = useMemo(() => {
    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)
    const tomorrowStart = startOfDay(addDays(now, 1))
    const tomorrowEnd = endOfDay(addDays(now, 1))

    return {
      overdue: todos.filter((t: TodoItem) => t.dueDate && t.dueDate < todayStart),
      todayDue: todos.filter(
        (t: TodoItem) => t.dueDate && t.dueDate >= todayStart && t.dueDate <= todayEnd
      ),
      tomorrowDue: todos.filter(
        (t: TodoItem) => t.dueDate && t.dueDate >= tomorrowStart && t.dueDate <= tomorrowEnd
      )
    }
  }, [todos])

  const handleClick = (todo: TodoItem): void => {
    openTab({
      type: 'todo-detail',
      pathname: ROUTES.TODO_DETAIL.replace(':todoId', todo.id),
      title: todo.title
    })
  }

  const isEmpty =
    groups.overdue.length === 0 && groups.todayDue.length === 0 && groups.tomorrowDue.length === 0

  return (
    <DashboardCard title="마감 임박" icon={AlertTriangle} isLoading={isLoading}>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground">마감 임박 할 일이 없습니다</p>
      ) : (
        <div className="space-y-3">
          {SECTION_CONFIG.map(({ key, label, dotClass, labelClass }, idx) => {
            const items = groups[key]
            if (items.length === 0) return null
            return (
              <div key={key}>
                {idx > 0 && groups[SECTION_CONFIG[idx - 1].key].length > 0 && (
                  <Separator className="mb-3" />
                )}
                <div className="mb-1.5 flex items-center gap-1.5">
                  <div className={`size-2 rounded-full ${dotClass}`} />
                  <span className={`text-xs font-medium ${labelClass}`}>{label}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 5).map((todo) => (
                    <button
                      key={todo.id}
                      className="flex w-full items-center rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent"
                      onClick={() => handleClick(todo)}
                    >
                      <span className="truncate">{todo.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DashboardCard>
  )
}
