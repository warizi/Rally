import { useDroppable } from '@dnd-kit/core'
import { cn } from '@shared/lib/utils'
import { useTreeDragStore } from '@shared/store/tree-drag.store'

export type DropPosition = 'top' | 'right' | 'bottom' | 'left' | 'center'

interface TabDropZoneProps {
  paneId: string
  position: DropPosition
  isDragging: boolean
}

export function TabDropZone({
  paneId,
  position,
  isDragging
}: TabDropZoneProps): React.ReactElement | null {
  // center는 탭 이동용, 나머지는 분할용
  const zoneId = position === 'center' ? `pane:${paneId}` : `split-zone:${paneId}:${position}`

  // store 셀렉터로 boolean만 구독 (dragover 마다 모든 zone re-render되는 것 방지)
  // - 폴더 드래그: 모든 위치 비활성
  // - 트리 드래그가 자기 패널일 때: split-zone(top/right/bottom/left)만 비활성, center는 유지
  const isFolderDrag = useTreeDragStore((s) => s.isFolderDrag)
  const isTreeDragOnSelfPane = useTreeDragStore(
    (s) => s.isTreeDragActive && s.sourcePaneId === paneId
  )
  const disabledForTreeDrag = isTreeDragOnSelfPane && position !== 'center'
  const disabled = isFolderDrag || disabledForTreeDrag

  const { setNodeRef, isOver } = useDroppable({
    id: zoneId,
    disabled
  })

  if (!isDragging) return null
  if (disabled) return null

  // 감지 영역: 겹치지 않도록 구성
  // top-9는 탭 바 높이
  const detectClasses: Record<DropPosition, string> = {
    top: 'top-9 left-[20%] right-[20%] h-[15%]',
    right: 'top-9 right-0 bottom-0 w-[20%]',
    bottom: 'bottom-0 left-[20%] right-[20%] h-[15%]',
    left: 'top-9 left-0 bottom-0 w-[20%]',
    center: 'top-[calc(36px+15%)] left-[20%] right-[20%] bottom-[15%]'
  }

  // 활성화 시 표시 영역
  const highlightClasses: Record<DropPosition, string> = {
    top: 'top-9 left-0 right-0 h-[calc(50%-18px)]',
    right: 'top-9 right-0 bottom-0 w-1/2',
    bottom: 'bottom-0 left-0 right-0 h-[calc(50%-18px)]',
    left: 'top-9 left-0 bottom-0 w-1/2',
    center: 'top-9 left-0 right-0 bottom-0'
  }

  return (
    <>
      {/* 활성화 시 하이라이트 표시 */}
      {isOver && (
        <div
          className={cn(
            'absolute z-40 pointer-events-none',
            position === 'center' ? 'bg-primary/10' : 'bg-primary/20',
            highlightClasses[position]
          )}
        />
      )}
      {/* 감지 영역 */}
      <div
        ref={setNodeRef}
        className={cn('absolute z-50 pointer-events-auto', detectClasses[position])}
      />
    </>
  )
}
