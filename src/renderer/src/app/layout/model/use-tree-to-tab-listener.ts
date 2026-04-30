import { useCallback } from 'react'
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core'
import { useTabStore } from '@/features/tap-system/manage-tab-system'
import { buildTabOptions } from '@/features/tap-system/manage-tab-system/lib/build-tab-options'
import type { TreeDragData } from '@shared/types/tree-drag'
import type { SplitPosition } from '@/features/tap-system/manage-tab-system'

const SPLIT_POSITIONS: Record<string, SplitPosition> = {
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left'
}

/**
 * 트리 노드를 탭 영역(TabBar / split-zone / pane center)으로 드롭하면
 * 새 탭을 연다 / 패널을 분할한다.
 *
 * over.id에서 paneId/position을 파싱해 분기:
 * - tab-list:{paneId}             → openTab(opts, paneId)
 * - split-zone:{paneId}:{position} → openTabInNewSplit(paneId, position, opts)
 * - pane:{paneId}                  → openTab(opts, paneId)  (center zone)
 */
export function useTreeToTabListener(): void {
  const openTab = useTabStore((s) => s.openTab)
  const openTabInNewSplit = useTabStore((s) => s.openTabInNewSplit)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const sourceData = event.active.data.current as TreeDragData | undefined
      if (!sourceData || sourceData.source !== 'tree-node') return
      // 폴더는 탭 오픈 대상에서 제외 (트리 내 이동만 허용)
      if (sourceData.kind === 'folder') return

      const overId = event.over?.id
      if (typeof overId !== 'string') return

      const opts = buildTabOptions({
        kind: sourceData.kind,
        id: sourceData.id,
        title: sourceData.title
      })

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
    [openTab, openTabInNewSplit]
  )

  useDndMonitor({ onDragEnd: handleDragEnd })
}
