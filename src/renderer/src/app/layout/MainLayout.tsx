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
import { usePdfWatcher } from '@entities/pdf-file'
import { useImageWatcher } from '@entities/image-file'
import { useCanvasWatcher } from '@entities/canvas'
import { useTodoWatcher } from '@entities/todo'
import { useEntityLinkWatcher } from '@entities/entity-link'
import { useReminderWatcher } from '@features/reminder'
import { UpdateChecker } from '../providers/update-checker'
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
import { TerminalBottomPanel } from '@/widgets/terminal-panel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@shared/ui/resizable'
import { useTerminalPanelStore } from '@features/terminal'
import { useTerminalSessionPersistence } from '@features/terminal/model/use-terminal-session-persistence'
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
  // 터미널 세션 영속성 활성화
  useTerminalSessionPersistence()
  const isTerminalOpen = useTerminalPanelStore((s) => s.isOpen)
  const panelSize = useTerminalPanelStore((s) => s.panelSize)
  const setPanelSize = useTerminalPanelStore((s) => s.setPanelSize)
  // 폴더/노트 변경 push 이벤트 구독
  useFolderWatcher()
  useNoteWatcher()
  useCsvWatcher()
  usePdfWatcher()
  useImageWatcher()
  // 캔버스 변경 push 이벤트 구독
  useCanvasWatcher()
  // todo 변경 push 이벤트 구독
  useTodoWatcher()
  // entity-link 변경 push 이벤트 구독 (orphan cleanup 시 캐시 동기화)
  useEntityLinkWatcher()
  // 알림 push 이벤트 구독
  useReminderWatcher()
  // 앱 업데이트 후 changelog 탭 자동 오픈
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
      <UpdateChecker />
      <MainSidebar />
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <main className="flex flex-1 overflow-hidden">
            <ResizablePanelGroup
              orientation="vertical"
              className="flex-1"
              onLayoutChanged={(layout) => {
                // layout[1] = 터미널 패널 크기 (드래그 완료 후 1회만 실행)
                if (isTerminalOpen && layout[1] !== undefined) {
                  setPanelSize(layout[1])
                }
              }}
            >
              <ResizablePanel defaultSize={isTerminalOpen ? 100 - panelSize : 100} minSize={20}>
                <PaneLayout routes={PANE_ROUTES} isDragging={!!draggingTabId} />
              </ResizablePanel>
              {isTerminalOpen && (
                <>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={panelSize} minSize={10}>
                    <TerminalBottomPanel />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
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
