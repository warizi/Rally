import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'
import { useTabStore } from '@features/tap-system/manage-tab-system'

export function useTerminal(containerRef: React.RefObject<HTMLDivElement | null>): void {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
  const closeTabByPathname = useTabStore((s) => s.closeTabByPathname)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !workspaceId) return

    let aborted = false

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4'
      }
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)

    termRef.current = term
    fitAddonRef.current = fitAddon

    fitAddon.fit()
    const { cols, rows } = term

    // pty 생성 또는 기존 pty 재연결
    window.api.workspace.getById(workspaceId).then((res) => {
      if (aborted) return
      if (!res.success || !res.data) return
      window.api.terminal.create({ cwd: res.data.path, cols, rows }).then((r) => {
        if (aborted) return
        if (r.success) created = true
      })
    })

    let created = false

    // pty stdout → xterm 렌더링
    const unsubData = window.api.terminal.onData(({ data }) => {
      term.write(data)
    })

    // 키 입력 → pty
    const disposeInput = term.onData((data) => {
      window.api.terminal.write({ data })
    })

    // shell 자체 종료 → 탭 닫기
    const unsubExit = window.api.terminal.onExit(() => {
      if (aborted || !created) return
      closeTabByPathname('/terminal')
    })

    // 리사이즈 감지
    const resizeObserver = new ResizeObserver(() => {
      if (aborted) return
      fitAddon.fit()
      const { cols, rows } = term
      if (cols > 0 && rows > 0) {
        window.api.terminal.resize({ cols, rows })
      }
    })
    resizeObserver.observe(container)

    return () => {
      aborted = true
      resizeObserver.disconnect()
      disposeInput.dispose()
      unsubData()
      unsubExit()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      // pty는 destroy하지 않음 — 탭 전환/pane 이동 시 프로세스 유지
      // pty는 워크스페이스 전환(create 시 cwd 변경), 앱 종료(before-quit), shell exit 시에만 종료
    }
  }, [workspaceId, containerRef, closeTabByPathname])
}
