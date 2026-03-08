import { app, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'

export function registerAppInfoHandlers(): void {
  ipcMain.handle('appInfo:getMcpServerPath', (): IpcResponse<string> => {
    return handle(() => {
      if (is.dev) {
        return join(process.cwd(), 'dist-mcp', 'index.js')
      }
      return join(process.resourcesPath, 'dist-mcp', 'index.js')
    })
  })
}
