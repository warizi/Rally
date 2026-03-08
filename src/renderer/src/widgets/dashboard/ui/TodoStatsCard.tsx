import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { useTodosByWorkspace } from '@entities/todo'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ROUTES } from '@shared/constants/tab-url'
import { useCountUp } from '@shared/hooks/use-count-up'
import { Button } from '@shared/ui/button'
import { DashboardCard } from '@shared/ui/dashboard-card'

interface TodoStatsCardProps {
  workspaceId: string
  className?: string
}

const STATUS_CONFIG = [
  { key: '할일', label: '할일', color: 'hsl(0 70% 72%)' },
  { key: '진행중', label: '진행중', color: 'hsl(30 85% 70%)' },
  { key: '보류', label: '보류', color: 'hsl(270 55% 72%)' },
  { key: '완료', label: '완료', color: 'hsl(0 0% 75%)' }
] as const

const PRIORITY_CONFIG = [
  { key: 'high', label: '높음', color: 'hsl(0 70% 72%)' },
  { key: 'medium', label: '보통', color: 'hsl(40 80% 70%)' },
  { key: 'low', label: '낮음', color: 'hsl(210 55% 72%)' }
] as const

function CountUp({ value }: { value: number }): React.JSX.Element {
  const display = useCountUp(value)
  return <>{display}</>
}

export function TodoStatsCard({ workspaceId, className }: TodoStatsCardProps): React.JSX.Element {
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
      className={className}
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
        <div className="space-y-6">
          {/* 완료율 */}
          <div className="flex items-end gap-1.5">
            <span className="text-4xl font-bold tracking-tight leading-none">
              <CountUp value={stats.completionRate} />
            </span>
            <span className="text-lg text-muted-foreground mb-0.5">%</span>
            <span className="text-sm text-muted-foreground ml-auto mb-0.5">
              <CountUp value={stats.byStatus.완료} /> / <CountUp value={stats.total} />
            </span>
          </div>

          {/* 스택 바 */}
          <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted">
            {STATUS_CONFIG.map(({ key, color }) => {
              const ratio = stats.total > 0 ? (stats.byStatus[key] / stats.total) * 100 : 0
              if (ratio === 0) return null
              return (
                <div
                  key={key}
                  className="h-full transition-all duration-300"
                  style={{ width: `${ratio}%`, backgroundColor: color }}
                />
              )
            })}
          </div>

          {/* 상태 목록 */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {STATUS_CONFIG.map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm tabular-nums font-semibold ml-auto">
                  <CountUp value={stats.byStatus[key]} />
                </span>
              </div>
            ))}
          </div>

          {/* 중요도 */}
          <div className="flex items-center gap-3 pt-2 border-t">
            {PRIORITY_CONFIG.map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs tabular-nums font-semibold">
                  <CountUp value={stats.byPriority[key]} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
