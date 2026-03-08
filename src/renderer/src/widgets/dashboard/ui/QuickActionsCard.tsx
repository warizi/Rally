import { Calendar, FolderOpen, Zap } from 'lucide-react'
import { useTabStore } from '@features/tap-system/manage-tab-system'
import { ROUTES } from '@shared/constants/tab-url'
import { Button } from '@shared/ui/button'
import { DashboardCard } from '@shared/ui/dashboard-card'

interface QuickActionsCardProps {
  workspaceId: string
  className?: string
  todoDialogTrigger: React.ReactNode
  scheduleDialogTrigger: React.ReactNode
}

export function QuickActionsCard({
  className,
  todoDialogTrigger,
  scheduleDialogTrigger
}: QuickActionsCardProps): React.JSX.Element {
  const openTab = useTabStore((s) => s.openTab)

  const handleOpenFolder = (): void => {
    openTab({ type: 'folder', pathname: ROUTES.FOLDER, title: '파일 탐색기' })
  }
  const handleOpenCalendar = (): void => {
    openTab({ type: 'calendar', pathname: ROUTES.CALENDAR, title: '캘린더' })
  }

  return (
    <DashboardCard title="빠른 액션" icon={Zap} className={className}>
      <div className="grid grid-cols-4 gap-2">
        {todoDialogTrigger}
        {scheduleDialogTrigger}
        <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={handleOpenFolder}>
          <FolderOpen className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">파일 탐색기</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 py-3"
          onClick={handleOpenCalendar}
        >
          <Calendar className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">캘린더</span>
        </Button>
      </div>
    </DashboardCard>
  )
}
