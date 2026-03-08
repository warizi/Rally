import { app, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, readdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import type { IpcResponse } from '../lib/ipc-response'
import { handle } from '../lib/handle'

export interface CommandFile {
  name: string
  content: string
}

export function registerAppInfoHandlers(): void {
  ipcMain.handle('appInfo:getMcpServerPath', (): IpcResponse<string> => {
    return handle(() => {
      if (is.dev) {
        return join(process.cwd(), 'dist-mcp', 'index.js')
      }
      return join(process.resourcesPath, 'dist-mcp', 'index.js')
    })
  })

  ipcMain.handle('appInfo:getCommandFiles', (): IpcResponse<CommandFile[]> => {
    return handle(() => {
      const commandsDir = is.dev
        ? join(process.cwd(), '.claude', 'commands')
        : join(process.resourcesPath, '.claude', 'commands')
      const files = readdirSync(commandsDir).filter((f) => f.endsWith('.md'))
      return files.map((f) => ({
        name: f.replace('.md', ''),
        content: readFileSync(join(commandsDir, f), 'utf-8')
      }))
    })
  })
}
