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
import { useTrashWatcher } from '@entities/trash'
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
import { ENTITY_ICON, ENTITY_ICON_COLOR } from '@shared/constants/entity-icon'
import type { TreeDragData, TreeNodeKind } from '@shared/types/tree-drag'
import { useTreeToTabListener } from './model/use-tree-to-tab-listener'
import { useTreeDragMonitor } from './model/use-tree-drag-monitor'
import { useHistoryLinkToTabListener } from './model/use-history-link-to-tab-listener'
import type { HistoryLink } from '@entities/history'
import type { HistoryLinkDragData } from '@/widgets/history-timeline'

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

function DraggingTreeNodeOverlay({
  node
}: {
  node: { kind: TreeNodeKind; title: string } | null
}): React.ReactElement | null {
  if (!node) return null
  const Icon = ENTITY_ICON[node.kind]
  const color = ENTITY_ICON_COLOR[node.kind]
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-background border rounded-md shadow-lg max-w-xl">
      <Icon className="size-4 shrink-0" style={{ color }} />
      <span className="text-sm truncate">{node.title}</span>
    </div>
  )
}

function DraggingHistoryLinkOverlay({
  link
}: {
  link: HistoryLink | null
}): React.ReactElement | null {
  if (!link) return null
  const Icon = ENTITY_ICON[link.type]
  const color = ENTITY_ICON_COLOR[link.type]
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-background border rounded-md shadow-lg max-w-xl">
      <Icon className="size-4 shrink-0" style={{ color }} />
      <span className="text-sm truncate">{link.title}</span>
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
  // 휴지통 변경 push 이벤트 구독 (소프트 삭제 / 복구 / 영구 삭제 시 활성 list 캐시 무효화)
  useTrashWatcher()

  // 드래그 상태 관리
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const [draggingTreeNode, setDraggingTreeNode] = useState<{
    kind: TreeNodeKind
    title: string
  } | null>(null)
  const [draggingHistoryLink, setDraggingHistoryLink] = useState<HistoryLink | null>(null)

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
  // tree-node / history-link source는 별도 listener에서 처리.
  const handleDragStart = (event: DragStartEvent): void => {
    const data = event.active.data.current as TreeDragData | HistoryLinkDragData | undefined
    if (data?.source === 'tree-node') {
      setDraggingTreeNode({ kind: data.kind, title: data.title })
      return
    }
    if (data?.source === 'history-link') {
      setDraggingHistoryLink(data.link)
      return
    }
    handleTabDragStart(event)
  }
  const handleDragEnd: typeof handleTabDragEnd = (event) => {
    setDraggingTreeNode(null)
    setDraggingHistoryLink(null)
    handleTabDragEnd(event)
  }

  const isAnyDragging = !!draggingTabId || !!draggingTreeNode || !!draggingHistoryLink

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
          {/* 히스토리 링크 노드를 탭 영역으로 드롭 → 새 탭 / 분할 */}
          <HistoryLinkToTabListener />
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
            ) : draggingHistoryLink ? (
              <DraggingHistoryLinkOverlay link={draggingHistoryLink} />
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
function HistoryLinkToTabListener(): null {
  useHistoryLinkToTabListener()
  return null
}

export default MainLayout
