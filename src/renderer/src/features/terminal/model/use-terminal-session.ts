import { useEffect, useRef, type RefObject } from 'react'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SerializeAddon } from '@xterm/addon-serialize'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from './store'

// CSS 변수를 실제 computed 색상(rgb 문자열)으로 읽어 xterm ITheme 생성
function buildThemeFromCSSVars(): ITheme {
  const tmp = document.createElement('div')
  tmp.style.display = 'none'
  document.body.appendChild(tmp)

  const read = (varName: string): string => {
    tmp.style.color = `var(${varName})`
    return window.getComputedStyle(tmp).color
  }

  const background = (() => {
    tmp.style.backgroundColor = 'var(--background)'
    return window.getComputedStyle(tmp).backgroundColor
  })()

  const foreground = read('--foreground')
  const cursor = read('--foreground')
  const selectionBackground = read('--muted-foreground')

  document.body.removeChild(tmp)

  return { background, foreground, cursor, selectionBackground }
}

export function useTerminalSession(
  sessionId: string | null,
  containerRef: RefObject<HTMLDivElement | null>
): void {
  const serializeAddonRef = useRef<SerializeAddon | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !sessionId) return

    let aborted = false

    const session = useTerminalStore.getState().sessions[sessionId]

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: buildThemeFromCSSVars()
    })
    const fitAddon = new FitAddon()
    const serializeAddon = new SerializeAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(serializeAddon)
    term.open(container)

    serializeAddonRef.current = serializeAddon

    // 저장된 스냅샷 복원
    if (session?.screenSnapshot) {
      term.write(session.screenSnapshot)
    }

    fitAddon.fit()
    const { cols, rows } = term

    // PTY에 현재 xterm 크기 전달
    window.api.terminal.resize({ id: sessionId, cols, rows })

    // pty stdout → xterm 렌더링
    const unsubData = window.api.terminal.onData(sessionId, ({ data }) => {
      term.write(data)
    })

    // 키 입력 → pty
    const disposeInput = term.onData((data) => {
      window.api.terminal.write({ id: sessionId, data })
    })

    // shell 종료 이벤트
    const unsubExit = window.api.terminal.onExit(sessionId, () => {
      // shell 종료 시 처리 (패널 유지)
    })

    // 앱 종료 시 현재 활성 세션 스냅샷 직접 DB 저장 (fire-and-forget)
    const handleQuit = (): void => {
      if (serializeAddonRef.current) {
        const snapshot = serializeAddonRef.current.serialize()
        window.api.terminal.saveSnapshot(sessionId, snapshot)
      }
    }
    window.addEventListener('beforeunload', handleQuit)

    // 다크/라이트 모드 전환 감지 → 터미널 테마 즉시 반영
    const themeObserver = new MutationObserver(() => {
      if (!aborted) {
        term.options.theme = buildThemeFromCSSVars()
      }
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    // 리사이즈 감지
    const resizeObserver = new ResizeObserver(() => {
      if (aborted) return
      // 레이아웃 완료 후 fit 실행 (flex 높이가 확정된 다음 프레임)
      requestAnimationFrame(() => {
        if (aborted) return
        const { clientWidth, clientHeight } = container
        if (clientWidth === 0 || clientHeight === 0) return
        fitAddon.fit()
        const { cols: newCols, rows: newRows } = term
        if (newCols > 0 && newRows > 0) {
          window.api.terminal.resize({ id: sessionId, cols: newCols, rows: newRows })
          useTerminalStore.getState().updateSession(sessionId, { cols: newCols, rows: newRows })
        }
      })
    })
    resizeObserver.observe(container)

    return () => {
      aborted = true
      window.removeEventListener('beforeunload', handleQuit)
      themeObserver.disconnect()

      // 탭 전환 시 스냅샷 → 스토어 저장
      if (serializeAddonRef.current && useTerminalStore.getState().sessions[sessionId]) {
        const snapshot = serializeAddonRef.current.serialize()
        useTerminalStore.getState().updateSession(sessionId, { screenSnapshot: snapshot })
      }

      resizeObserver.disconnect()
      disposeInput.dispose()
      unsubData()
      unsubExit()
      term.dispose()
      serializeAddonRef.current = null
    }
  }, [sessionId, containerRef])
}
