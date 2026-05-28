import { useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useTreeDragStore } from '@shared/store/tree-drag.store'
import { AnimatePresence } from 'framer-motion'
import { Ellipsis } from 'lucide-react'
import { TabItem } from './TabItem'
import { TabContextMenu } from './TabContextMenu'
import { useTabStore } from '@/entities/tab-system'
import { ScrollArea, ScrollBar } from '@/shared/ui/scroll-area'
import { useSidebar } from '@/shared/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/shared/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

interface TabBarProps {
  paneId: string
  showSidebarTrigger?: boolean
  isDragRegion?: boolean
}

export function TabBar({
  paneId,
  showSidebarTrigger = false,
  isDragRegion = true
}: TabBarProps): React.ReactElement {
  const pane = useTabStore((state) => state.panes[paneId])
  const tabs = useTabStore((state) => state.tabs)
  const isPaneActive = useTabStore((state) => state.activePaneId === paneId)
  const activateTab = useTabStore((state) => state.activateTab)
  const closeTab = useTabStore((state) => state.closeTab)
  const closeAllTabs = useTabStore((state) => state.closeAllTabs)
  const { state: sidebarState } = useSidebar()

  // 폴더 노드 드래그 시 TabBar는 비활성화 (폴더는 탭으로 열리지 않음).
  // boolean 셀렉터로 구독 — 드래그 시작/종료 시점에만 re-render.
  const isFolderDrag = useTreeDragStore((s) => s.isFolderDrag)

  const { setNodeRef, isOver } = useDroppable({
    id: `tab-list:${paneId}`,
    disabled: isFolderDrag
  })

  const viewportRef = useRef<HTMLDivElement>(null)

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    if (!viewportRef.current) return
    // 트랙패드 가로 스왑이 있으면 native 처리 그대로 두고, 세로 휠만 가로 스크롤로 변환
    if (e.deltaX !== 0) return
    if (e.deltaY === 0) return
    viewportRef.current.scrollLeft += e.deltaY
  }

  if (!pane) return <div className="h-9 bg-muted" />

  const paneTabs = pane.tabIds.map((id) => tabs[id]).filter(Boolean)

  return (
    <div
      ref={setNodeRef}
      className={cn('flex flex-row items-center h-10 w-full pt-0.5', isDragRegion && 'drag-region')}
    >
      {' '}
      {showSidebarTrigger && (
        <div
          className={cn(
            'shrink-0 sticky left-0 z-10 bg-none no-drag-region',
            sidebarState === 'collapsed' && 'ml-10'
          )}
        />
      )}
      <ScrollArea
        viewportRef={viewportRef}
        onWheel={handleWheel}
        className={cn('h-10 rounded-lg pb-1', isOver && 'bg-primary/20')}
        style={{ flex: 1, minWidth: 0 }}
      >
        <div className="inline-flex items-center h-9 pr-1">
          <SortableContext items={pane.tabIds} strategy={horizontalListSortingStrategy}>
            <AnimatePresence mode="popLayout">
              {paneTabs.map((tab) => (
                <TabContextMenu key={tab.id} tab={tab} paneId={paneId}>
                  <div>
                    <TabItem
                      tab={tab}
                      isActive={pane.activeTabId === tab.id}
                      isPaneActive={isPaneActive}
                      onActivate={() => activateTab(tab.id, paneId)}
                      onClose={() => closeTab(tab.id)}
                    />
                  </div>
                </TabContextMenu>
              ))}
            </AnimatePresence>
          </SortableContext>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="shrink-0 flex items-center justify-center size-8 ml-1.5 bg-none rounded-lg text-foreground hover:text-foreground no-drag-region">
            <Ellipsis className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => closeAllTabs(paneId)}>모두 닫기</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
