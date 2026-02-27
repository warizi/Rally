import { useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { X, Pin } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { Tab } from '@/entities/tab-system'
import { TAB_ICON } from '@/shared/constants/tab-url'

interface TabItemProps {
  tab: Tab
  isActive: boolean
  onActivate: () => void
  onClose: () => void
  onContextMenu?: (event: React.MouseEvent) => void
}

export function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
  onContextMenu
}: TabItemProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id
  })
  const itemRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [isActive])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const Icon = TAB_ICON[tab.icon]

  const handleClose = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <div
        ref={(node) => {
          setNodeRef(node)
          ;(itemRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onActivate}
        onContextMenu={onContextMenu}
        className={cn(
          'group flex items-center h-8 gap-2 px-3 py-1 mt-1 rounded-tl-md rounded-tr-md ml-1 border-t border-x border-border',
          'cursor-pointer select-none transition-colors',
          'hover:bg-background',
          'min-w-45 max-w-45',
          isActive && 'bg-background',
          isDragging && 'opacity-50 z-50',
          !isActive && 'bg-muted/30',
          'no-drag-region'
        )}
      >
        {/* 아이콘 */}
        <Icon
          className={cn('size-4 shrink-0 text-muted-foreground', tab.error && 'text-destructive')}
        />

        {/* 제목 */}
        <span
          className={cn('text-sm truncate flex-1', tab.error && 'line-through text-destructive')}
        >
          {tab.title}
        </span>

        {/* 고정 표시 */}
        {tab.pinned && <Pin className="size-3 text-muted-foreground shrink-0" />}

        {/* 닫기 버튼 */}
        {!tab.pinned && (
          <button
            onClick={handleClose}
            className={cn(
              'size-4 rounded-sm flex items-center justify-center shrink-0',
              'text-muted-foreground/50 hover:text-foreground transition-colors',
              'cursor-pointer'
            )}
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
