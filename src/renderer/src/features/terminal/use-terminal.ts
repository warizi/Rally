import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useCurrentWorkspaceStore } from '@shared/store/current-workspace'

export function useTerminal(containerRef: React.RefObject<HTMLDivElement | null>): void {
  const workspaceId = useCurrentWorkspaceStore((s) => s.currentWorkspaceId)
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
      window.api.terminal.create({ cwd: res.data.path, cols, rows })
    })

    // pty stdout → xterm 렌더링
    const unsubData = window.api.terminal.onData(({ data }) => {
      term.write(data)
    })

    // 키 입력 → pty
    const disposeInput = term.onData((data) => {
      window.api.terminal.write({ data })
    })

    // shell 자체 종료 시
    const unsubExit = window.api.terminal.onExit(() => {
      // shell exit — 패널은 열려 있되 pty만 종료된 상태
    })

    // 리사이즈 감지 — 컨테이너가 보이지 않으면(w=0) skip
    const resizeObserver = new ResizeObserver(() => {
      if (aborted) return
      const { clientWidth, clientHeight } = container
      if (clientWidth === 0 || clientHeight === 0) return
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
    }
  }, [workspaceId, containerRef])
}
