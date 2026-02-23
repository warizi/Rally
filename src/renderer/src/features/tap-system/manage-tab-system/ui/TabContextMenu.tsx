import { Tab } from '@/entities/tab-system'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@shared/ui/context-menu'
import { Pin, PinOff, SplitSquareHorizontal, SplitSquareVertical, X } from 'lucide-react'
import { useTabStore } from '../model/store'

interface TabContextMenuProps {
  tab: Tab
  paneId: string
  children: React.ReactNode
}

export function TabContextMenu({ tab, paneId, children }: TabContextMenuProps): React.ReactElement {
  const { closeTab, pinTab, unpinTab, splitPane } = useTabStore.getState()

  const handlePin = (): void => {
    if (tab.pinned) {
      unpinTab(tab.id)
    } else {
      pinTab(tab.id)
    }
  }

  const handleClose = (): void => {
    closeTab(tab.id)
  }

  const handleSplitRight = (): void => {
    splitPane(paneId, 'right', tab.id)
  }

  const handleSplitDown = (): void => {
    splitPane(paneId, 'bottom', tab.id)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {/* 고정/해제 */}

        <ContextMenuItem onClick={handlePin}>
          {tab.pinned ? (
            <>
              <PinOff className="size-4 mr-2" />
              고정 해제
            </>
          ) : (
            <>
              <Pin className="size-4 mr-2" />탭 고정
            </>
          )}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* 분할 */}
        <ContextMenuItem onClick={handleSplitRight}>
          <SplitSquareHorizontal className="size-4 mr-2" />
          오른쪽으로 분할
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSplitDown}>
          <SplitSquareVertical className="size-4 mr-2" />
          아래로 분할
        </ContextMenuItem>

        {/* 닫기 */}
        {!tab.pinned && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleClose} variant="destructive">
              <X className="size-4 mr-2" />탭 닫기
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
