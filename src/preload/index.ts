import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { initTerminalListeners } from './lib/terminal-listeners'
import { api, shellApi } from './apis'

initTerminalListeners()

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('shell', shellApi)
  } catch (error) {
    // electron-log 가 아닌 console.error 사용:
    // contextBridge 자체 실패는 일반 logger 도입 이전 단계의 부트스트랩 에러이므로
    // renderer→main forwarding 도 작동 보장 못 함. 콘솔 직출이 가장 안전.
    // eslint-disable-next-line no-console
    console.error('[preload] contextBridge expose failed:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.shell = shellApi
}
