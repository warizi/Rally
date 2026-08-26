import { Tab } from '@/entities/tab-system'
import { PaneRoute } from '@/shared/lib/pane-route'
import { findMatchingRoute } from '@/shared/lib/route-matcher'
import { cn } from '@/shared/lib/utils'
import { Suspense } from 'react'
import { ErrorBoundary } from '@/shared/ui/error-boundary'
import { TabErrorFallback } from '@/shared/ui/error-fallback'

interface PaneContentProps {
  tab: Tab | null
  routes: PaneRoute[]
  className?: string
}

function LoadingFallback(): React.ReactElement {
  return (
    <div className="flex-1 flex items-center justify-center w-full h-full rounded-lg">
      <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )
}

function NotFoundContent({ pathname }: { pathname: string }): React.ReactElement {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background rounded-lg">
      <p className="text-muted-foreground">페이지를 찾을 수 없습니다</p>
      <p className="text-sm text-muted-foreground/60 mt-1">{pathname}</p>
    </div>
  )
}

export function PaneContent({ tab, routes, className }: PaneContentProps): React.ReactElement {
  if (!tab) {
    return (
      <div
        className={cn(
          'flex-1 flex items-center justify-center bg-background rounded-lg',
          className
        )}
      >
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
    <div className={cn('flex-1 overflow-auto bg-background rounded-lg', className)}>
      {/*
        M-5: 모든 탭 페이지의 단일 렌더 지점이라 여기 한 곳만 감싸면 전 탭이 보호된다.
        FolderPage 처럼 TabContainer 를 쓰지 않는 예외도 자동으로 포함된다.
        resetKey=tab.id — 같은 자리에 다른 탭이 오면 이전 오류를 끌고 가지 않는다.
      */}
      <ErrorBoundary
        resetKey={tab.id}
        label={`tab:${tab.icon}`}
        fallback={(error, reset) => <TabErrorFallback error={error} reset={reset} />}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Component key={tab.id} tabId={tab.id} params={params} search={tab.searchParams} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
