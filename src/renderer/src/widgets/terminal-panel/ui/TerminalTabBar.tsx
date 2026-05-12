import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { AnimatePresence } from 'framer-motion'
import { useTerminalStore } from '@features/terminal/model/store'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { ScrollArea, ScrollBar } from '@shared/ui/scroll-area'
import { TerminalTabItem } from './TerminalTabItem'

/**
 * 터미널 패널 탭 바. 일반 탭 바와 동일한 DnD 패턴 (useSortable + 수평 리스트).
 * 자체 DndContext 로 메인 레이아웃의 DnD 와 격리.
 */
export function TerminalTabBar(): React.ReactElement {
  const sessions = useTerminalStore((s) => s.sessions)
  const activeSessionId = useTerminalStore((s) => s.activeSessionId)
  const setActive = useTerminalStore((s) => s.setActiveSession)
  const addSession = useTerminalStore((s) => s.addSession)
  const updateSession = useTerminalStore((s) => s.updateSession)
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)

  const sortedSessions = Object.values(sessions).sort((a, b) => a.sortOrder - b.sortOrder)
  const sessionIds = sortedSessions.map((s) => s.id)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }
    })
  )

  const handleAddTab = async (): Promise<void> => {
    if (!workspaceId) return
    const wsRes = await window.api.workspace.getById(workspaceId)
    if (!wsRes.success || !wsRes.data) return
    const cwd = wsRes.data.path

    const sortOrder = sortedSessions.length
    const res = await window.api.terminal.create({
      workspaceId,
      cwd,
      cols: 80,
      rows: 24,
      sortOrder
    })
    if (!res.success || !res.data) return

    addSession({
      id: res.data.id,
      name: 'zsh',
      cwd,
      shell: 'zsh',
      rows: 24,
      cols: 80,
      screenSnapshot: null,
      sortOrder
    })
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sessionIds.indexOf(active.id as string)
    const newIndex = sessionIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    // arrayMove 로 재배열 후 각 session 의 sortOrder 를 새 인덱스로 갱신.
    // 일관성 위해 일괄 IPC 송신 — 부분 갱신 시 다음 reorder 가 stale state 사용 위험.
    const reordered = arrayMove(sortedSessions, oldIndex, newIndex)
    reordered.forEach((session, idx) => {
      if (session.sortOrder !== idx) {
        updateSession(session.id, { sortOrder: idx })
        window.api.terminal.updateSession(session.id, { sortOrder: idx })
      }
    })
  }

  return (
    <div className="flex items-center h-9 bg-muted border-b border-border shrink-0">
      {/* 좌측: 가로 스크롤 가능한 탭 리스트 (shadcn ScrollArea 로 수직 스크롤 차단) */}
      <ScrollArea className="flex-1 h-full min-w-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sessionIds} strategy={horizontalListSortingStrategy}>
            <AnimatePresence initial={false}>
              <div className="flex items-center h-full w-max">
                {sortedSessions.map((session) => (
                  <TerminalTabItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onActivate={() => setActive(session.id)}
                  />
                ))}
              </div>
            </AnimatePresence>
          </SortableContext>
        </DndContext>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* 우측 고정: 새 터미널 추가 버튼 */}
      <button
        className="shrink-0 flex items-center justify-center size-9 text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors text-base"
        onClick={handleAddTab}
        title="새 터미널"
      >
        +
      </button>
    </div>
  )
}
