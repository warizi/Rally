import { useMemo } from 'react'
import { Network } from 'lucide-react'
import { useCanvasesByWorkspace } from '@entities/canvas'
import type { CanvasItem } from '@entities/canvas'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ROUTES } from '@shared/constants/tab-url'
import { Badge } from '@shared/ui/badge'
import { Button } from '@shared/ui/button'
import { DashboardCard } from '@shared/ui/dashboard-card'

interface RecentCanvasCardProps {
  workspaceId: string
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return date.toLocaleDateString('ko-KR')
}

export function RecentCanvasCard({ workspaceId }: RecentCanvasCardProps): React.JSX.Element {
  const { data: canvases = [], isLoading } = useCanvasesByWorkspace(workspaceId)
  const openTab = useTabStore((s) => s.openTab)

  const recentCanvases = useMemo(
    () =>
      [...canvases]
        .sort((a: CanvasItem, b: CanvasItem) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 5),
    [canvases]
  )

  const handleClick = (canvas: CanvasItem): void => {
    openTab({
      type: 'canvas-detail',
      pathname: ROUTES.CANVAS_DETAIL.replace(':canvasId', canvas.id),
      title: canvas.title
    })
  }

  const handleViewAll = (): void => {
    openTab({ type: 'canvas', pathname: ROUTES.CANVAS, title: '캔버스' })
  }

  return (
    <DashboardCard
      title="최근 캔버스"
      icon={Network}
      isLoading={isLoading}
      action={
        <div className="flex items-center gap-1">
          {canvases.length > 0 && <Badge variant="secondary">{canvases.length}</Badge>}
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleViewAll}>
            모두 보기
          </Button>
        </div>
      }
    >
      {recentCanvases.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">캔버스가 없습니다</p>
          <Button variant="outline" size="sm" onClick={handleViewAll}>
            캔버스 만들기
          </Button>
        </div>
      ) : (
        <div className="space-y-0.5">
          {recentCanvases.map((canvas) => (
            <button
              key={canvas.id}
              className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
              onClick={() => handleClick(canvas)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm">{canvas.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatRelativeTime(canvas.updatedAt)}
                </span>
              </div>
              {canvas.description && (
                <p className="truncate text-xs text-muted-foreground">{canvas.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
