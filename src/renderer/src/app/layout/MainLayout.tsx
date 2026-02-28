import { SidebarProvider } from '@/shared/ui/sidebar'
import MainSidebar from './MainSidebar'
import {
  useSessionPersistence,
  useTabDnd,
  useTabStore
} from '@/features/tap-system/manage-tab-system'
import { useFolderWatcher } from '@entities/folder'
import { useNoteWatcher } from '@entities/note'
import { useCsvWatcher } from '@entities/csv-file'
import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { PaneLayout } from '@/widgets/tab-system'
import { PANE_ROUTES } from './model/pane-routes'
import { TAB_ICON } from '@/shared/constants/tab-url'

function DraggingTabOverlay({ tabId }: { tabId: string | null }): React.ReactElement | null {
  const tab = useTabStore((state) => (tabId ? state.tabs[tabId] : null))

  if (!tab) return null

  const Icon = TAB_ICON[tab.icon]

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-md shadow-lg">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-sm">{tab.title}</span>
    </div>
  )
}

function MainLayout(): React.JSX.Element {
  // 세션 영속성 활성화
  useSessionPersistence()
  // 폴더/노트 변경 push 이벤트 구독
  useFolderWatcher()
  useNoteWatcher()
  useCsvWatcher()
  // 드래그 상태 관리
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  // 드래그 활성화 조건: 8px 이상 이동해야 드래그 시작
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  const { handleDragStart, handleDragEnd } = useTabDnd({
    onDragStart: (tabId) => setDraggingTabId(tabId),
    onDragEnd: () => setDraggingTabId(null)
  })

  return (
    <SidebarProvider>
      <MainSidebar />
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <main className="flex-1 overflow-hidden">
            <PaneLayout routes={PANE_ROUTES} isDragging={!!draggingTabId} />
          </main>
          <DragOverlay dropAnimation={null}>
            <DraggingTabOverlay tabId={draggingTabId} />
          </DragOverlay>
        </DndContext>
      </div>
    </SidebarProvider>
  )
}

export default MainLayout
