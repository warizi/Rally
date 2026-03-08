import { useCallback } from 'react'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SplitPosition } from './types'
import { useTabStore } from './store'

interface UseTabDndOptions {
  onDragStart?: (tabId: string) => void
  onDragEnd?: () => void
}

interface UseTabDndReturn {
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
}

// 드롭존 ID 파싱
interface ParsedDropZone {
  type: 'split' | 'tab-list' | 'pane'
  paneId: string
  position?: SplitPosition
}

function parseDropZoneId(droppableId: string): ParsedDropZone | null {
  // split-zone:{paneId}:{position}
  if (droppableId.startsWith('split-zone:')) {
    const parts = droppableId.split(':')
    if (parts.length === 3) {
      return {
        type: 'split',
        paneId: parts[1],
        position: parts[2] as SplitPosition
      }
    }
  }

  // tab-list:{paneId}
  if (droppableId.startsWith('tab-list:')) {
    const paneId = droppableId.replace('tab-list:', '')
    return { type: 'tab-list', paneId }
  }

  // pane:{paneId}
  if (droppableId.startsWith('pane:')) {
    const paneId = droppableId.replace('pane:', '')
    return { type: 'pane', paneId }
  }

  return null
}

export function useTabDnd(options: UseTabDndOptions = {}): UseTabDndReturn {
  const splitPane = useTabStore((state) => state.splitPane)
  const moveTabToPane = useTabStore((state) => state.moveTabToPane)
  const findPaneByTabId = useTabStore((s) => s.findPaneByTabId)

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const tabId = event.active.id as string
      options.onDragStart?.(tabId)
    },
    [options]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      options.onDragEnd?.()

      const { active, over } = event
      if (!over) return

      const tabId = active.id as string
      const droppableId = over.id as string

      // 같은 위치에 드롭하면 무시
      if (tabId === droppableId) return

      // 현재 탭이 있는 패인 찾기
      const sourcePane = findPaneByTabId(tabId)
      if (!sourcePane) return

      const dropZone = parseDropZoneId(droppableId)

      // 드롭존이 아닌 경우 (다른 탭 위에 드롭) - 탭 순서 변경
      if (!dropZone) {
        const overPane = findPaneByTabId(droppableId)
        // 같은 패인 내의 탭이면 순서 변경
        if (overPane && overPane.id === sourcePane.id) {
          const pane = sourcePane
          const oldIndex = pane.tabIds.indexOf(tabId)
          const newIndex = pane.tabIds.indexOf(droppableId)

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const newTabIds = [...pane.tabIds]
            newTabIds.splice(oldIndex, 1)
            newTabIds.splice(newIndex, 0, tabId)

            useTabStore.setState((state) => ({
              panes: {
                ...state.panes,
                [pane.id]: {
                  ...pane,
                  tabIds: newTabIds
                }
              }
            }))
          }
        }
        return
      }

      switch (dropZone.type) {
        case 'split':
          // 분할 영역에 드롭: 새 패인 생성
          if (dropZone.position) {
            splitPane(dropZone.paneId, dropZone.position, tabId)
          }
          break

        case 'tab-list':
        case 'pane':
          // 다른 패인의 탭 목록에 드롭: 탭 이동
          if (sourcePane.id !== dropZone.paneId) {
            moveTabToPane(tabId, sourcePane.id, dropZone.paneId)
          }
          break
      }
    },
    [splitPane, moveTabToPane, findPaneByTabId, options]
  )

  return {
    handleDragStart,
    handleDragEnd
  }
}

// 탭 목록 내 재정렬을 위한 훅
export function useReorderTabs(paneId: string): (activeId: string, overId: string) => void {
  return useCallback(
    (activeId: string, overId: string) => {
      // 최신 상태 가져오기
      const currentPanes = useTabStore.getState().panes
      const pane = currentPanes[paneId]
      if (!pane) return

      const oldIndex = pane.tabIds.indexOf(activeId)
      const newIndex = pane.tabIds.indexOf(overId)

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      // 배열 재정렬
      const newTabIds = [...pane.tabIds]
      newTabIds.splice(oldIndex, 1)
      newTabIds.splice(newIndex, 0, activeId)

      // 스토어 업데이트
      useTabStore.setState({
        panes: {
          ...currentPanes,
          [paneId]: {
            ...pane,
            tabIds: newTabIds
          }
        }
      })
    },
    [paneId]
  )
}
