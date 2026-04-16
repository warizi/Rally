import { useRef } from 'react'
import { useTerminalPanelStore } from '@features/terminal'
import { useTerminalStore } from '@features/terminal/model/store'
import { useTerminalSession } from '@features/terminal/model/use-terminal-session'
import { TerminalTabBar } from './TerminalTabBar'

export function TerminalBottomPanel(): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasBeenOpened = useTerminalPanelStore((s) => s.hasBeenOpened)
  const activeSessionId = useTerminalStore((s) => s.activeSessionId)

  // hasBeenOpened 전까지 초기화 안 함 (lazy init 유지)
  useTerminalSession(hasBeenOpened ? activeSessionId : null, containerRef)

  if (!hasBeenOpened) return null

  return (
    <div className="flex flex-col h-full min-h-0 bg-background border-t border-border overflow-hidden">
      <TerminalTabBar />
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  )
}
