import { useEffect, useRef } from 'react'
import { useTerminal, useTerminalPanelStore } from '@features/terminal'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'

export function TerminalPanel(): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null)
  const isOpen = useTerminalPanelStore((s) => s.isOpen)
  const hasBeenOpened = useTerminalPanelStore((s) => s.hasBeenOpened)
  const reset = useTerminalPanelStore((s) => s.reset)
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)

  // 워크스페이스 전환 시 터미널 패널 리셋
  const prevWorkspaceRef = useRef(workspaceId)
  useEffect(() => {
    if (prevWorkspaceRef.current && prevWorkspaceRef.current !== workspaceId) {
      // 기존 pty를 먼저 정리한 뒤 패널 리셋
      window.api.terminal.destroy()
      reset()
    }
    prevWorkspaceRef.current = workspaceId
  }, [workspaceId, reset])

  // hasBeenOpened 상태일 때만 터미널 초기화
  useTerminal(hasBeenOpened ? containerRef : { current: null })

  if (!workspaceId || !hasBeenOpened) return null

  return (
    <div
      className={`border-l border-sidebar-border bg-[#1e1e1e] overflow-hidden transition-[width] duration-200 ${
        isOpen ? 'w-[480px]' : 'w-0'
      }`}
    >
      <div ref={containerRef} className="h-full w-[480px]" />
    </div>
  )
}
