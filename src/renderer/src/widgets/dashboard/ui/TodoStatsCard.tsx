import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { useTodosByWorkspace } from '@entities/todo'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ROUTES } from '@shared/constants/tab-url'
import { Button } from '@shared/ui/button'
import { DashboardCard } from '@shared/ui/dashboard-card'
import { Progress } from '@shared/ui/progress'
import { Separator } from '@shared/ui/separator'

interface TodoStatsCardProps {
  workspaceId: string
}

const STATUS_CONFIG = [
  { key: '할일', label: '할일', class: 'bg-chart-1' },
  { key: '진행중', label: '진행중', class: 'bg-chart-4' },
  { key: '완료', label: '완료', class: 'bg-primary' },
  { key: '보류', label: '보류', class: 'bg-muted-foreground/40' }
] as const

const PRIORITY_CONFIG = [
  {
    key: 'high',
    label: '높음',
    dot: 'bg-rose-400 dark:bg-rose-500',
    badge:
      'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
  },
  {
    key: 'medium',
    label: '보통',
    dot: 'bg-amber-400 dark:bg-amber-500',
    badge:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
  },
  {
    key: 'low',
    label: '낮음',
    dot: 'bg-sky-400 dark:bg-sky-500',
    badge:
      'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
  }
] as const

export function TodoStatsCard({ workspaceId }: TodoStatsCardProps): React.JSX.Element {
  const { data: todos = [], isLoading } = useTodosByWorkspace(workspaceId, { filter: 'all' })
  const openTab = useTabStore((s) => s.openTab)

  const stats = useMemo(() => {
    const total = todos.length
    const byStatus: Record<string, number> = {
      할일: 0,
      진행중: 0,
      완료: 0,
      보류: 0
    }
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 }

    for (const t of todos) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1
      if (!t.isDone) {
        byPriority[t.priority] = (byPriority[t.priority] || 0) + 1
      }
    }

    const completionRate = total > 0 ? Math.round((byStatus.완료 / total) * 100) : 0
    return { total, byStatus, byPriority, completionRate }
  }, [todos])

  const handleViewAll = (): void => {
    openTab({ type: 'todo', pathname: ROUTES.TODO, title: '할 일' })
  }

  return (
    <DashboardCard
      title="할 일 통계"
      icon={Check}
      isLoading={isLoading}
      action={
        <Button variant="ghost" size="sm" className="text-xs" onClick={handleViewAll}>
          모두 보기
        </Button>
      }
    >
      {stats.total === 0 ? (
        <p className="text-sm text-muted-foreground">할 일이 없습니다</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight">{stats.completionRate}%</span>
              <span className="text-xs text-muted-foreground">
                {stats.byStatus.완료}/{stats.total} 완료
              </span>
            </div>
            <Progress value={stats.completionRate} className="h-2" />
          </div>

          <Separator />

          <div className="space-y-1.5">
            {STATUS_CONFIG.map(({ key, label, class: cls }) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <div className={`size-2 rounded-full ${cls}`} />
                <span className="text-muted-foreground">{label}</span>
                <span className="ml-auto tabular-nums font-medium">{stats.byStatus[key]}</span>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex flex-wrap gap-1.5">
            {PRIORITY_CONFIG.map(({ key, label, badge }) =>
              stats.byPriority[key] > 0 ? (
                <span
                  key={key}
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${badge}`}
                >
                  {label} {stats.byPriority[key]}
                </span>
              ) : null
            )}
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
