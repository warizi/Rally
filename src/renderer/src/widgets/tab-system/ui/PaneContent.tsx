import { Tab } from '@/entities/tab-system'
import { PaneRoute } from '@/shared/lib/pane-route'
import { findMatchingRoute } from '@/shared/lib/route-matcher'
import { cn } from '@/shared/lib/utils'
import { Suspense } from 'react'

interface PaneContentProps {
  tab: Tab | null
  routes: PaneRoute[]
  className?: string
}

function LoadingFallback(): React.ReactElement {
  return (
    <div className="flex-1 flex items-center justify-center w-full h-full">
      <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )
}

function NotFoundContent({ pathname }: { pathname: string }): React.ReactElement {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background">
      <p className="text-muted-foreground">페이지를 찾을 수 없습니다</p>
      <p className="text-sm text-muted-foreground/60 mt-1">{pathname}</p>
    </div>
  )
}

export function PaneContent({ tab, routes, className }: PaneContentProps): React.ReactElement {
  if (!tab) {
    return (
      <div className={cn('flex-1 flex items-center justify-center bg-background', className)}>
        <p className="text-muted-foreground">탭을 선택하세요</p>
      </div>
    )
  }

  // 라우트 매칭
  const matched = findMatchingRoute(routes, tab.pathname)

  if (!matched) {
    return <NotFoundContent pathname={tab.pathname} />
  }

  const { route, params } = matched
  const Component = route.component

  return (
    <div className={cn('flex-1 overflow-auto bg-background', className)}>
      <Suspense fallback={<LoadingFallback />}>
        <Component key={tab.id} tabId={tab.id} params={params} search={tab.searchParams} />
      </Suspense>
    </div>
  )
}
