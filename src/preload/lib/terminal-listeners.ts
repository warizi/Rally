import { ipcRenderer } from 'electron'

// 세션 ID → 콜백 라우팅. terminal API의 onData/onExit가 이 Map에 콜백을 등록한다.
export const terminalDataListeners = new Map<string, (d: { data: string }) => void>()
export const terminalExitListeners = new Map<string, (d: { exitCode: number }) => void>()

let initialized = false

// preload 진입 시 1회만 호출. 중복 호출 시 ipcRenderer 리스너가 누적되는 것을 막는다.
export function initTerminalListeners(): void {
  if (initialized) return
  initialized = true

  ipcRenderer.on('terminal:data', (_, payload: { id: string; data: string }) => {
    terminalDataListeners.get(payload.id)?.(payload)
  })
  ipcRenderer.on('terminal:exit', (_, payload: { id: string; exitCode: number }) => {
    terminalExitListeners.get(payload.id)?.(payload)
  })
}
