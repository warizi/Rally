import type { LucideIcon } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@shared/ui/card'
import { Skeleton } from '@shared/ui/skeleton'

interface DashboardCardProps {
  title: string
  icon: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  isLoading?: boolean
}

export function DashboardCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  isLoading
}: DashboardCardProps): React.JSX.Element {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{isLoading ? <DashboardCardSkeleton /> : children}</CardContent>
    </Card>
  )
}

function DashboardCardSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
