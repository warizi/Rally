import { useTerminalStore } from '@features/terminal/model/store'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { TerminalTabItem } from './TerminalTabItem'

export function TerminalTabBar(): React.ReactElement {
  const sessions = useTerminalStore((s) => s.sessions)
  const activeSessionId = useTerminalStore((s) => s.activeSessionId)
  const setActive = useTerminalStore((s) => s.setActiveSession)
  const addSession = useTerminalStore((s) => s.addSession)
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)

  const sortedSessions = Object.values(sessions).sort((a, b) => a.sortOrder - b.sortOrder)

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

  return (
    <div className="flex items-center h-9 bg-muted border-b border-border overflow-x-auto shrink-0">
      {sortedSessions.map((session) => (
        <TerminalTabItem
          key={session.id}
          session={session}
          isActive={session.id === activeSessionId}
          onActivate={() => setActive(session.id)}
        />
      ))}
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
