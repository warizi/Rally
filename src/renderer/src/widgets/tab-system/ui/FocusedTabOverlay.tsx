import { selectFocusedTabId, useTabStore } from '@/entities/tab-system'
import { PaneRoute } from '@/shared/lib/pane-route'
import { Button } from '@shared/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { PaneContent } from './PaneContent'

interface FocusedTabOverlayProps {
  routes: PaneRoute[]
}

export function FocusedTabOverlay({ routes }: FocusedTabOverlayProps): React.ReactElement {
  const focusedTabId = useTabStore(selectFocusedTabId)
  const focusedTab = useTabStore((state) => (focusedTabId ? state.tabs[focusedTabId] : null))
  const exitFocusMode = useTabStore((state) => state.exitFocusMode)

  return (
    <AnimatePresence>
      {focusedTab && (
        <motion.div
          key="focused-tab-overlay"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          {/* 상단 여백 — 윈도우 드래그 영역 + X 버튼 자리 */}
          <div className="drag-region relative h-10 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label="화면 전체보기 해제"
              onClick={exitFocusMode}
              className="no-drag-region absolute right-3 top-1/2 size-8 -translate-y-1/2"
            >
              <X className="size-4" />
            </Button>
          </div>
          <PaneContent
            tab={focusedTab}
            routes={routes}
            className="flex-1 overflow-auto rounded-none"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
