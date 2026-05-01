import { useCallback } from 'react'
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { useTabStore, type SplitPosition } from '@/features/tap-system/manage-tab-system'
import {
  linkToTabOptions,
  type HistoryLinkDragData
} from '@/widgets/history-timeline'

const SPLIT_POSITIONS: Record<string, SplitPosition> = {
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left'
}

/**
 * 히스토리 링크 노드를 탭 영역(TabBar / split-zone / pane center)으로 드롭하면
 * 새 탭을 연다 / 패널을 분할한다. 트리 노드 listener와 동일한 라우팅 규칙.
 */
export function useHistoryLinkToTabListener(): void {
  const openTab = useTabStore((s) => s.openTab)
  const openTabInNewSplit = useTabStore((s) => s.openTabInNewSplit)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const sourceData = event.active.data.current as HistoryLinkDragData | undefined
      if (!sourceData || sourceData.source !== 'history-link') return

      const overId = event.over?.id
      if (typeof overId !== 'string') return

      const opts = linkToTabOptions(sourceData.link)
      if (!opts) return

      closeTabByPathname(opts.pathname)

      if (overId.startsWith('tab-list:')) {
        const paneId = overId.slice('tab-list:'.length)
        openTab(opts, paneId)
        return
      }
      if (overId.startsWith('pane:')) {
        const paneId = overId.slice('pane:'.length)
        openTab(opts, paneId)
        return
      }
      if (overId.startsWith('split-zone:')) {
        const parts = overId.split(':')
        if (parts.length !== 3) return
        const paneId = parts[1]
        const position = SPLIT_POSITIONS[parts[2]]
        if (!position) return
        openTabInNewSplit(paneId, position, opts)
      }
    },
    [openTab, openTabInNewSplit, closeTabByPathname]
  )

  useDndMonitor({ onDragEnd: handleDragEnd })
}
