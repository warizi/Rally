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
  useSensors,
  type DragStartEvent
} from '@dnd-kit/core'
import { PaneLayout } from '@/widgets/tab-system'
import { TerminalBottomPanel } from '@/widgets/terminal-panel'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@shared/ui/resizable'
import { useTerminalPanelStore } from '@features/terminal'
import { useTerminalSessionPersistence } from '@features/terminal/model/use-terminal-session-persistence'
import { PANE_ROUTES } from './model/pane-routes'
import { TAB_ICON, type TabType } from '@/shared/constants/tab-url'
import { FileText, Folder, ImageIcon, Sheet } from 'lucide-react'
import { PdfIcon } from '@shared/ui/icons/PdfIcon'
import type { TreeDragData, TreeNodeKind } from '@shared/types/tree-drag'
import { useTreeToTabListener } from './model/use-tree-to-tab-listener'
import { useTreeDragMonitor } from './model/use-tree-drag-monitor'

function DraggingTabOverlay({ tabId }: { tabId: string | null }): React.ReactElement | null {
  const tab = useTabStore((state) => (tabId ? state.tabs[tabId] : null))

  if (!tab) return null

  const Icon = TAB_ICON[tab.icon as TabType]

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-md shadow-lg">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-sm">{tab.title}</span>
    </div>
  )
}

const TREE_KIND_ICON: Record<TreeNodeKind, React.ElementType> = {
  folder: Folder,
  note: FileText,
  csv: Sheet,
  pdf: PdfIcon,
  image: ImageIcon
}

function DraggingTreeNodeOverlay({
  node
}: {
  node: { kind: TreeNodeKind; title: string } | null
}): React.ReactElement | null {
  if (!node) return null
  const Icon = TREE_KIND_ICON[node.kind]
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-md shadow-lg">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-sm">{node.title}</span>
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

  // 드래그 상태 관리
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [draggingTreeNode, setDraggingTreeNode] = useState<{
    kind: TreeNodeKind
    title: string
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  const { handleDragStart: handleTabDragStart, handleDragEnd: handleTabDragEnd } = useTabDnd({
    onDragStart: (tabId) => setDraggingTabId(tabId),
    onDragEnd: () => setDraggingTabId(null)
  })

  // DnDContext의 onDragStart/onDragEnd는 source 종류별로 분기.
  // tree-node source는 별도 listener (useTreeMoveListener / useTreeToTabListener)에서 처리.
  const handleDragStart = (event: DragStartEvent): void => {
    const data = event.active.data.current as TreeDragData | undefined
    if (data?.source === 'tree-node') {
      setDraggingTreeNode({ kind: data.kind, title: data.title })
      return
    }
    handleTabDragStart(event)
  }
  const handleDragEnd: typeof handleTabDragEnd = (event) => {
    setDraggingTreeNode(null)
    handleTabDragEnd(event)
  }

  const isAnyDragging = !!draggingTabId || !!draggingTreeNode

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
          {/* 트리 노드를 탭 영역으로 드롭하면 새 탭 / 분할 — useDndMonitor로 별도 처리 */}
          <TreeToTabListener />
          {/* 트리 DnD 상태를 store에 동기화 (각 렌더러는 store 셀렉터로 구독) */}
          <TreeDragMonitor />
          <main className="flex flex-1 overflow-hidden">
            <ResizablePanelGroup
              orientation="vertical"
              className="flex-1"
              onLayoutChanged={(layout) => {
                if (isTerminalOpen && layout[1] !== undefined) {
                  setPanelSize(layout[1])
                }
              }}
            >
              <ResizablePanel defaultSize={isTerminalOpen ? 100 - panelSize : 100} minSize={20}>
                <PaneLayout routes={PANE_ROUTES} isDragging={isAnyDragging} />
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
            {draggingTreeNode ? (
              <DraggingTreeNodeOverlay node={draggingTreeNode} />
            ) : (
              <DraggingTabOverlay tabId={draggingTabId} />
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </SidebarProvider>
  )
}

// useDndMonitor는 DndContext 내부에서만 호출 가능하므로 이렇게 분리한 컴포넌트로 사용.
function TreeToTabListener(): null {
  useTreeToTabListener()
  return null
}
function TreeDragMonitor(): null {
  useTreeDragMonitor()
  return null
}

export default MainLayout
