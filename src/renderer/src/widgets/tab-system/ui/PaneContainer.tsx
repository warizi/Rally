import { PaneRoute } from '@/shared/lib/pane-route'
import { PaneContent } from './PaneContent'
import { TabBar, TabDropZone, useTabStore } from '@/features/tap-system/manage-tab-system'
import { cn } from '@/shared/lib/utils'

interface PaneContainerProps {
  paneId: string
  routes: PaneRoute[]
  isDragging: boolean
  showSidebarTrigger?: boolean
  isTopRow?: boolean
}

export function PaneContainer({
  paneId,
  routes,
  isDragging,
  showSidebarTrigger = false,
  isTopRow = true
}: PaneContainerProps): React.ReactElement {
  const pane = useTabStore((state) => state.panes[paneId])
  const tabs = useTabStore((state) => state.tabs)
  const activePaneId = useTabStore((state) => state.activePaneId)
  const setActivePane = useTabStore((state) => state.setActivePane)

  if (!pane) {
    return <div className="flex-1 bg-muted" />
  }

  const activeTab = pane.activeTabId ? tabs[pane.activeTabId] : null
  const isActivePane = activePaneId === paneId

  const handleFocus = (): void => {
    setActivePane(paneId)
  }

  return (
    <div
      onClick={handleFocus}
      className={cn(
        'flex flex-col h-full relative min-w-75 min-h-75 w-full overflow-hidden',
        isActivePane && 'ring-1 ring-primary ring-inset'
      )}
    >
      {/* 탭 바 */}
      <TabBar paneId={paneId} showSidebarTrigger={showSidebarTrigger} isDragRegion={isTopRow} />

      {/* 컨텐츠 영역 */}
      <PaneContent tab={activeTab} routes={routes} className="flex-1 overflow-auto" />

      {/* 드래그 중일 때 드롭존 표시 */}
      {isDragging && (
        <>
          <TabDropZone paneId={paneId} position="top" isDragging={isDragging} />
          <TabDropZone paneId={paneId} position="right" isDragging={isDragging} />
          <TabDropZone paneId={paneId} position="bottom" isDragging={isDragging} />
          <TabDropZone paneId={paneId} position="left" isDragging={isDragging} />
          <TabDropZone paneId={paneId} position="center" isDragging={isDragging} />
        </>
      )}
    </div>
  )
}
