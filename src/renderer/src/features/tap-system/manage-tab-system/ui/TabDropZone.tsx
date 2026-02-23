import { useDroppable } from '@dnd-kit/core'
import { cn } from '@shared/lib/utils'

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

  const { setNodeRef, isOver } = useDroppable({
    id: zoneId
  })

  if (!isDragging) return null

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
