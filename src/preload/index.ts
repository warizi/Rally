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
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.shell = shellApi
}
