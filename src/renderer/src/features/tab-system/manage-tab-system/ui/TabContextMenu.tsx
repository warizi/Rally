import { Tab } from '@/entities/tab-system'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@shared/ui/context-menu'
import {
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  SplitSquareHorizontal,
  SplitSquareVertical,
  X,
  XCircle
} from 'lucide-react'
import { selectFocusedTabId } from '../model/selectors'
import { useTabStore } from '../model/store'

interface TabContextMenuProps {
  tab: Tab
  paneId: string
  children: React.ReactNode
}

export function TabContextMenu({ tab, paneId, children }: TabContextMenuProps): React.ReactElement {
  // top 인 탭만 "해제" 라벨로 토글 (스택 모델 기준)
  const isFocused = useTabStore((state) => selectFocusedTabId(state) === tab.id)
  const { closeTab, closeOtherTabs, pinTab, unpinTab, splitPane, enterFocusMode, exitFocusMode } =
    useTabStore.getState()

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

  const handleCloseOthers = (): void => {
    closeOtherTabs(paneId, tab.id)
  }

  const handleSplitRight = (): void => {
    splitPane(paneId, 'right', tab.id)
  }

  const handleSplitDown = (): void => {
    splitPane(paneId, 'bottom', tab.id)
  }

  const handleToggleFocus = (): void => {
    if (isFocused) {
      exitFocusMode()
    } else {
      enterFocusMode(tab.id)
    }
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

        {/* 화면 전체보기 토글 */}
        <ContextMenuItem onClick={handleToggleFocus}>
          {isFocused ? (
            <>
              <Minimize2 className="size-4 mr-2" />
              화면 전체보기 해제
            </>
          ) : (
            <>
              <Maximize2 className="size-4 mr-2" />
              화면 전체보기
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
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCloseOthers}>
          <XCircle className="size-4 mr-2" />
          현재 탭 제외 모두 닫기
        </ContextMenuItem>
        {!tab.pinned && (
          <ContextMenuItem onClick={handleClose} variant="destructive">
            <X className="size-4 mr-2" />탭 닫기
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
