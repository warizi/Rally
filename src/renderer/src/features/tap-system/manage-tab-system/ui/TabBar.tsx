import { useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { AnimatePresence } from 'framer-motion'
import { TabItem } from './TabItem'
import { TabContextMenu } from './TabContextMenu'
import { useTabStore } from '../model/store'
import { ScrollArea, ScrollBar } from '@/shared/ui/scroll-area'
import { SidebarTrigger } from '@/shared/ui/sidebar'
import { cn } from '@/shared/lib/utils'

interface TabBarProps {
  paneId: string
  showSidebarTrigger?: boolean
}

export function TabBar({ paneId, showSidebarTrigger = false }: TabBarProps): React.ReactElement {
  const pane = useTabStore((state) => state.panes[paneId])
  const tabs = useTabStore((state) => state.tabs)
  const activateTab = useTabStore((state) => state.activateTab)
  const closeTab = useTabStore((state) => state.closeTab)

  const { setNodeRef, isOver } = useDroppable({
    id: `tab-list:${paneId}`
  })

  if (!pane) return <div className="h-9 bg-muted" />

  const paneTabs = pane.tabIds.map((id) => tabs[id]).filter(Boolean)

  return (
    <ScrollArea className={cn('h-9 w-full bg-muted', isOver && 'bg-primary/20')}>
      <div ref={setNodeRef} className="inline-flex items-center h-9 w-full">
        {showSidebarTrigger && <SidebarTrigger className="shrink-0 sticky left-0 z-10 bg-muted" />}
        <SortableContext items={pane.tabIds} strategy={horizontalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {paneTabs.map((tab) => (
              <TabContextMenu key={tab.id} tab={tab} paneId={paneId}>
                <div>
                  <TabItem
                    tab={tab}
                    isActive={pane.activeTabId === tab.id}
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
  )
}
